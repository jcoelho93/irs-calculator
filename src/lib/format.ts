const eur0 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtEur = (n: number, precise = false): string => (precise ? eur2 : eur0).format(n);
export const fmtPct = (fraction: number, digits = 1): string => `${(fraction * 100).toFixed(digits)}%`;
export const download = (filename: string, text: string, mime = "application/json"): void => {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
