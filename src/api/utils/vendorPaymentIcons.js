/**
 * Payment icons per AWIN merchant_name.
 * Keys must match CSV merchant_name exactly (case-sensitive).
 */
export const VENDOR_PAYMENT_ICONS = {
  "Giga Tyres EU": [
    "/images/icons/payments/Visa.png",
    "/images/icons/payments/Mastercard.png",
    "/images/icons/payments/American_Express.png",
    "/images/icons/payments/amazon-pay.svg",
    "/images/icons/payments/paypal.svg",
  ],
  "Reifen.com": [
    "/images/icons/payments/paypal.svg",
    "/images/icons/payments/amazon-pay.svg",
    "/images/icons/payments/Klarna.svg",
  ],
  // AWIN advertiser id 10719 — separate from Reifen.com
  "reifen DE": [
    "/images/icons/payments/Visa.png",
    "/images/icons/payments/Mastercard.png",
    "/images/icons/payments/paypal.svg",
    "/images/icons/payments/Klarna.svg",
    "/images/icons/payments/sepa.png",
    "/images/icons/payments/amazon-pay.svg",
  ],
  "Reifen DE": [
    "/images/icons/payments/Visa.png",
    "/images/icons/payments/Mastercard.png",
    "/images/icons/payments/paypal.svg",
    "/images/icons/payments/Klarna.svg",
    "/images/icons/payments/sepa.png",
    "/images/icons/payments/amazon-pay.svg",
  ],
  "Reifen24 DE": [
    "/images/icons/payments/Visa.png",
    "/images/icons/payments/Mastercard.png",
    "/images/icons/payments/paypal.svg",
    "/images/icons/payments/Vorkasse.png",
    "/images/icons/payments/sepa.png",
    "/images/icons/payments/Rechnung.png",
    "/images/icons/payments/apple-pay.png",
  ],
  "ReifenDirekt.de": [
    "/images/icons/payments/Visa.png",
    "/images/icons/payments/Mastercard.png",
    "/images/icons/payments/paypal.svg",
    "/images/icons/payments/bank-transfer.png",
    "/images/icons/payments/American_Express.png",
    "/images/icons/payments/amazon-pay.svg",
    "/images/icons/payments/sepa.png",
  ],
  "Reifentiefpreis DE": [
    "/images/icons/payments/Visa.png",
    "/images/icons/payments/Mastercard.png",
    "/images/icons/payments/sofort.png",
    "/images/icons/payments/paypal.svg",
    "/images/icons/payments/bank-transfer.png",
    "/images/icons/payments/American_Express.png",
  ],
  "Tyrigo DE": ["/images/icons/payments/paypal.svg"],
  "Goodwheel DE": [
    "/images/icons/payments/Visa.png",
    "/images/icons/payments/Mastercard.png",
    "/images/icons/payments/paypal.svg",
    "/images/icons/payments/Rechnung.png",
    "/images/icons/payments/Vorkasse.png",
    "/images/icons/payments/Klarna.svg",
  ],
  "Tirendo DE": [
    "/images/icons/payments/Visa.png",
    "/images/icons/payments/Mastercard.png",
    "/images/icons/payments/paypal.svg",
    "/images/icons/payments/bank-transfer.png",
    "/images/icons/payments/American_Express.png",
    "/images/icons/payments/amazon-pay.svg",
    "/images/icons/payments/sepa.png",
  ],
  "Vergölst DE": [
    "/images/icons/payments/Visa.png",
    "/images/icons/payments/Mastercard.png",
    "/images/icons/payments/paypal.svg",
  ],
  "Vergoelst DE": [
    "/images/icons/payments/Visa.png",
    "/images/icons/payments/Mastercard.png",
    "/images/icons/payments/paypal.svg",
  ],
  "vergoelst.de": [
    "/images/icons/payments/Visa.png",
    "/images/icons/payments/Mastercard.png",
    "/images/icons/payments/paypal.svg",
  ],
};

/** Case-insensitive lookup with common aliases */
export function getVendorPaymentIcons(merchantName = "") {
  const raw = String(merchantName || "").trim();
  if (!raw) return [];
  if (VENDOR_PAYMENT_ICONS[raw]) return VENDOR_PAYMENT_ICONS[raw];

  const lower = raw.toLowerCase();
  for (const [key, icons] of Object.entries(VENDOR_PAYMENT_ICONS)) {
    if (key.toLowerCase() === lower) return icons;
  }

  // Aliases
  if (lower === "reifen.de" || lower === "reifende") {
    return VENDOR_PAYMENT_ICONS["reifen DE"];
  }
  return [];
}
