import fs from "fs";
import path from "path";

/**
 * Folders that hold downloaded product images (each contains product-image/).
 * The image job writes into every root; the API serves from every root, so
 * a file is reachable no matter which folder it landed in.
 *
 * Order: LOCAL_IMAGE_DIR (explicit), then the sibling frontend checkout as the
 * VPS lays it out (…/reifencheck/backend + …/reifencheck/frontend), then the
 * older guessed locations kept for existing files.
 */
export function imageRoots({ create = false, onlyExisting = true } = {}) {
    // Explicit folders: LOCAL_IMAGE_DIR may hold one path or a ":"-separated list.
    const explicit = String(process.env.LOCAL_IMAGE_DIR || "")
        .split(path.delimiter)
        .map((p) => p.trim())
        .filter((p) => path.isAbsolute(p))
        .map((p) => path.resolve(p.replace(/[/\\]product-image[/\\]?$/i, "")));

    // The frontend checkout next to this backend (VPS: …/reifencheck/backend + /frontend).
    const primary = [...explicit, path.resolve(process.cwd(), "../frontend/public/images")];

    // Older guessed locations: read from them if they already exist (they may
    // hold images saved before), but never create them.
    const legacy = [
        path.resolve(process.cwd(), "../reifenhier-de-frontend/public/images"),
        path.resolve(process.cwd(), "../../frontend/public/images"),
    ];

    const isDir = (p) => {
        try { return fs.statSync(p).isDirectory(); } catch { return false; }
    };

    const roots = [...new Set([...primary, ...legacy])];
    if (!onlyExisting && !create) return roots;

    return roots.filter((root) => {
        if (create && primary.includes(root)) {
            try { fs.mkdirSync(path.join(root, "product-image"), { recursive: true }); } catch { /* ignore */ }
        }
        return isDir(root);
    });
}
