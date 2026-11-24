/**
 * Rough weight of each make on German roads (VW = 100). Only used to order
 * the models (rank = make weight × model popularity); plans show the top N.
 * Keys are vehicleKey() brand parts (lower case, no spaces/hyphens).
 */
const WEIGHTS = {
  vw: 100, mercedes: 70, bmw: 62, opel: 60, audi: 55, ford: 55, skoda: 48, renault: 36, toyota: 32,
  seat: 30, hyundai: 30, fiat: 28, peugeot: 26, dacia: 24, kia: 24, mazda: 20, nissan: 18, citroen: 18,
  cupra: 14, volvo: 14, mini: 14, tesla: 12, suzuki: 12, porsche: 10, mitsubishi: 9, honda: 9, smart: 8,
  mg: 8, jeep: 6, landrover: 6, alfaromeo: 5, lexus: 4, jaguar: 4, subaru: 4, ds: 3, byd: 3, polestar: 3,
  chevrolet: 3, ssangyong: 2, kgmobility: 2, lancia: 2, saab: 2, abarth: 2, chrysler: 1.5, dodge: 1.5, lada: 1.5,
  daihatsu: 1.5, rover: 1, genesis: 1, lynkco: 1, maserati: 1, cadillac: 0.3, infiniti: 0.5, isuzu: 0.5,
}

export const makeWeight = (brandKey) => WEIGHTS[String(brandKey || '')] ?? 1
