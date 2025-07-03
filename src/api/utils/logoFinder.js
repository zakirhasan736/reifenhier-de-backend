
import fs from "fs";
import path from "path";
import slugify from "./slugify.js"; // Assuming slugify.js is in the same directory

const EXT = ["webp", "png", "jpg", "jpeg", "svg"];

/**
 * Looks up the logo path for vendors in src/images/vendors/.
 * Returns a relative path you can use in your frontend.
 */
export function findLogo(type, name) {
    // If name is not provided, return the default logo
    if (!name) {
        console.log(`No name provided for ${type}. Returning default logo.`);
        return ``;
    }

    // Slugify the vendor name to create the filename
    const slug = slugify(name);
    console.log(`Slugified name for ${type}: ${slug}`);

    // Loop through possible file extensions
    for (const ext of EXT) {
        const localPath = path.join(process.cwd(), "src", "images", type, `${slug}.${ext}`);
        console.log(`Checking for logo at path: ${localPath}`);

        // Check if the file exists in the directory
        if (fs.existsSync(localPath)) {
            console.log(`Found logo for ${name} at ${localPath}`);
            return `/images/${type}/${slug}.${ext}`;  // Return the relative path for the logo
        }
    }

    // If no logo found, return the default logo
    console.log(`No logo found for ${name}. Returning default.`);
    return ``;
}
