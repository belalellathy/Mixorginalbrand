export const formatEGP = (value) => {
  return 'EGP ' + (Math.round(Number(value) * 100) / 100).toFixed(2)
}
