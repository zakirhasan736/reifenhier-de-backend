#!/usr/bin/env python3
"""Reifencheck MongoDB setup and offline migration. Run as root on the Linux VPS."""
import argparse
import fcntl
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time
from urllib.parse import quote, urlsplit

ROOT = Path("/var/lib/reifencheck-mongodb")
CONFIG = ROOT / "settings.json"
CONTAINER = "reifencheck-mongodb"
LOCAL = "mongodb://localhost:27018/?directConnection=true"
SYSTEM = {"admin", "config", "local"}

def run(args, *, payload=None, capture=False):
    return subprocess.run(args, input=payload, text=True, check=True,
                          stdout=subprocess.PIPE if capture else None)

def docker(*args, **kwargs):
    return run(["docker", *args], **kwargs)

def exclusive(path, data):
    with path.open("x") as stream:
        stream.write(data)

def shell(uri, code, **params):
    program = """
const p = JSON.parse(require("fs").readFileSync(0, "utf8"));
const db = connect(p.uri);
""" + code
    result = docker("exec", "-i", CONTAINER, "mongosh", "--nodb", "--quiet",
                    "--eval", program, payload=json.dumps(dict(uri=uri, **params)), capture=True)
    return result.stdout.strip()

def admin(cfg):
    return "mongodb://migration_admin:" + cfg["admin"] + "@localhost:27018/admin?directConnection=true"

def setup(series):
    docker("info", capture=True)
    if CONFIG.exists() or any(ROOT.iterdir()):
        sys.exit("Setup requires a fresh state directory. Inspect the existing installation first.")
    image = "mongo:" + series
    docker("pull", image)
    # Confirm every required binary before writing local state.
    docker("run", "--rm", "--entrypoint", "sh", image, "-ec",
           "command -v mongosh && mongodump --version && mongorestore --version")
    uid = int(docker("run", "--rm", "--entrypoint", "id", image, "-u", "mongodb", capture=True).stdout)
    cfg = {"admin": secrets.token_hex(32), "app": secrets.token_hex(32), "series": series}
    exclusive(CONFIG, json.dumps(cfg))
    key = ROOT / "replica.key"
    exclusive(key, secrets.token_hex(64))
    os.chown(key, uid, -1)
    key.chmod(0o400)
    for folder in ("data", "archives"):
        (ROOT / folder).mkdir(mode=0o700)
    os.chown(ROOT / "data", uid, -1)
    docker("run", "-d", "--name", CONTAINER, "--restart", "unless-stopped",
           "--network", "host", "-v", str(ROOT / "data") + ":/data/db",
           "-v", str(ROOT / "archives") + ":/archives",
           "-v", str(key) + ":/run/replica.key:ro", image, "mongod",
           "--bind_ip", "127.0.0.1", "--port", "27018", "--auth",
           "--keyFile", "/run/replica.key", "--replSet", "reifencheck")
    for _ in range(45):
        probe = subprocess.run(["docker","exec",CONTAINER,"mongosh",LOCAL,"--quiet","--eval",
                                "db.runCommand({ping:1}).ok"], capture_output=True)
        if probe.returncode == 0:
            break
        time.sleep(1)
    else:
        sys.exit("MongoDB failed to start. Inspect docker logs reifencheck-mongodb.")
    shell(LOCAL, """
const result = db.adminCommand({replSetInitiate:{_id:"reifencheck",members:[{_id:0,host:"localhost:27018"}]}});
if (!result.ok) throw Error(result.errmsg);
""")
    shell(LOCAL, """
for (let i=0; i<90 && !db.hello().isWritablePrimary; i++) sleep(1000);
if (!db.hello().isWritablePrimary) throw Error("No primary");
db.getSiblingDB("admin").createUser({user:"migration_admin",pwd:p.password,roles:["root"]});
""", password=cfg["admin"])
    shell(admin(cfg), 'print(db.adminCommand({connectionStatus:1}).authInfo.authenticatedUsers[0].user)')
    print("Local replica set ready. Next run inventory.")

def atlas():
    uri = getpass.getpass("Atlas mongodb+srv URI (hidden; use a read-only migration login): ").strip()
    if urlsplit(uri).scheme != "mongodb+srv" or not urlsplit(uri).hostname:
        sys.exit("Expected an Atlas mongodb+srv URI.")
    return uri

def inventory(uri, cfg):
    data = json.loads(shell(uri, """
const a=db.getSiblingDB("admin");
const r=a.runCommand({listDatabases:1,nameOnly:true,authorizedDatabases:true});
if (!r.ok) throw Error(r.errmsg);
print(JSON.stringify({version:db.version(),names:r.databases.map(x=>x.name).sort()}));
"""))
    names = [n for n in data["names"] if n not in SYSTEM]
    print("Atlas version:", data["version"], " Visible application databases:", ", ".join(names))
    if not data["version"].startswith(cfg["series"] + "."):
        sys.exit("Version series differs from the selected destination. Review compatibility before copying.")
    if not names:
        sys.exit("No visible application databases.")
    return names

MANIFEST = """
const d=db.getSiblingDB(p.name);
const out = d.getCollectionInfos().filter(c=>!c.name.startsWith("system."))
.sort((a,b)=>a.name.localeCompare(b.name)).map(c=>{
 const v={name:c.name,type:c.type,options:c.options};
 if (c.type!=="view") {
   const coll=d.getCollection(c.name);
   v.count=coll.countDocuments({});
   v.indexes=coll.getIndexes().sort((a,b)=>a.name.localeCompare(b.name))
     .map(i=>({...i,key:Object.entries(i.key)}));
 }
 return v;
});
print(EJSON.stringify(out));
"""

def manifest(uri, name):
    return json.loads(shell(uri, MANIFEST, name=name))

def copy(cfg):
    source = atlas()
    names = inventory(source, cfg)
    app = input("Exact database used by the running backend: ").strip()
    if app not in names:
        sys.exit("Backend database must appear in inventory.")
    for name in names:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
            sys.exit("Database name needs manual review: " + name)
        if shell(admin(cfg), 'print(db.getSiblingDB(p.name).getCollectionInfos().length)', name=name) != "0":
            sys.exit("Destination already contains collections in " + name + ". No overwrite performed.")
    if input("After pausing ALL Atlas writers, type COPY to start: ") != "COPY":
        sys.exit("Copy cancelled.")
    archive = Path(tempfile.mkdtemp(prefix="copy-", dir=ROOT / "archives"))
    for name in names:
        before = manifest(source, name)
        file = "/archives/" + archive.name + "/" + name + ".gz"
        for tool, uri, args in [
            ("mongodump", source, ["--db", name]),
            ("mongorestore", admin(cfg), ["--stopOnError", "--nsInclude", name + ".*"])
        ]:
            docker("exec","-i",CONTAINER,tool,"--config=/dev/stdin","--gzip",
                   "--archive="+file,*args,payload=json.dumps({"uri":uri})+"\n")
        if manifest(admin(cfg), name) != before or manifest(source, name) != before:
            sys.exit("Counts, indexes, views, or collection options differ in " + name + ". Keep Atlas active.")
        print("Verified:", name, flush=True)
    shell(admin(cfg), """
db.getSiblingDB(p.name).createUser({user:"reifencheck_app",pwd:p.password,
 roles:[{role:"readWrite",db:p.name}]});
""", name=app, password=cfg["app"])
    uri = ("mongodb://reifencheck_app:" + cfg["app"] + "@127.0.0.1:27018/" + quote(app,safe="")
           + "?authSource=" + quote(app,safe="") + "&replicaSet=reifencheck&directConnection=true")
    shell(uri,'print(db.getCollectionNames().length)')
    exclusive(ROOT / "backend.env", "MONGODB_URI=" + uri + "\n")
    print("Copy verified. Backend URI saved in", ROOT / "backend.env")
    print("Archive directory:", archive)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["setup","inventory","copy"])
    parser.add_argument("--series", choices=["7.0","8.0","8.2","8.3"], default="8.0")
    args = parser.parse_args()
    if os.geteuid() != 0:
        sys.exit("Run as root.")
    os.umask(0o077)
    ROOT.mkdir(mode=0o700, exist_ok=True)
    with open("/run/lock/reifencheck-mongo.lock","a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.action == "setup":
            setup(args.series)
        else:
            cfg=json.loads(CONFIG.read_text())
            if args.action=="inventory":
                inventory(atlas(), cfg)
            else:
                copy(cfg)

if __name__ == "__main__":
    main()
