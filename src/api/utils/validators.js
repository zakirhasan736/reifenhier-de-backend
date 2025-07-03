// src/api/utils/validators.js

export function isValidVendor(row, allowedVendor = 'reifencom') {
    const vendor = (row["merchant_name"] || "").toLowerCase().replace(/\s|\./g, "");
    return vendor === allowedVendor;
}

export function isValidSecondCategory(row) {
    const secondCategory = (row["merchant_product_second_category"] || "").trim().toLowerCase();
    return secondCategory === 'reifen';
}

export function isValidThirdCategory(row) {
    const thirdCategory = (row["merchant_product_third_category"] || "").trim();
    return !!thirdCategory;
}
  