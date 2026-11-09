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
    const roots = new Set();
    const envBase = (process.env.LOCAL_IMAGE_DIR || "").trim();
    if (envBase) roots.add(path.resolve(envBase.replace(/[/\\]product-image[/\\]?$/i, "")));
    roots.add(path.resolve(process.cwd(), "../frontend/public/images"));
    roots.add(path.resolve(process.cwd(), "../reifenhier-de-frontend/public/images"));
    roots.add(path.resolve(process.cwd(), "../../frontend/public/images"));

    if (!onlyExisting && !create) return [...roots];

    return [...roots].filter((root) => {
        if (create) {
            try {
                fs.mkdirSync(path.join(root, "product-image"), { recursive: true });
            } catch {
                return false;
            }
        }
        try {
            return fs.statSync(root).isDirectory();
        } catch {
            return false;
        }
    });
}
