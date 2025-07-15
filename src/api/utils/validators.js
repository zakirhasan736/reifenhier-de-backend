// src/api/utils/validators.js

// export function isValidVendor(row, allowedVendor = 'reifencom') {
//     const vendor = (row["merchant_name"] || "").toLowerCase().replace(/\s|\./g, "");
//     return vendor === allowedVendor;
// }

// export function isValidSecondCategory(row) {
//     const secondCategory = (row["merchant_product_second_category"] || "").trim().toLowerCase();
//     return secondCategory === 'reifen';
// }

// export function isValidThirdCategory(row) {
//     const thirdCategory = (row["merchant_product_third_category"] || "").trim();
//     return !!thirdCategory;
// }
// src/api/utils/validators.js

// validators.js

/**
 * Returns true if vendor is accepted (currently always true)
 */
export function isValidVendor(row) {
    // Accept all vendors; add exclusions if needed
    return true;
}

/**
 * Returns true if this Reifen.com row is a car tyre by second category
 * (STRICT: only 'reifen')
 */
export function isValidSecondCategory(row) {
    const secondCategory = (row["merchant_product_second_category"] || "").trim().toLowerCase();
    return secondCategory === 'reifen';
}

/**
 * Returns true if third category is present (not empty)
 */
export function isValidThirdCategory(row) {
    const thirdCategory = (row["merchant_product_third_category"] || "").trim();
    return !!thirdCategory;
}

/**
 * Checks if a row is a car tyre. Only validate using Reifen.com vendor!
 * (Passes all others by default)
 */
export function isCarTyreRow(row) {
    const vendor = (row["merchant_name"] || "").trim().toLowerCase();
    if (vendor === "reifen.com") {
        // Only validate Reifen.com
        return isValidSecondCategory(row) && isValidThirdCategory(row);
    }
    // Other vendors are not checked for car tyre by category, handled via group
    return true;
}

/**
 * Determines if a group (array of rows for one EAN) is a car tyre group.
 * Only groups with at least one Reifen.com row that passes category validation
 * are considered car tyres.
 */
export function isCarTyreGroup(rows) {
    // Accept if any row is from Reifen.com and passes BOTH category validations
    return rows.some(row =>
        (row["merchant_name"] || "").trim().toLowerCase() === "reifen.com"
        && isValidSecondCategory(row)
        && isValidThirdCategory(row)
    );
}
