// app/lib/commonHelpers.ts

/**
 * Multi string position detection. Returns an associative object of all found positions.
 */
export function multiStrpos(str: string, check: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const s of check) {
    const pos = str.indexOf(s);
    if (pos !== -1) {
      result[s] = pos;
    }
  }
  return result;
}

/**
 * Converts a numeric amount into English words.
 */
export function convertNumberToWords(num: number): string {
  const dictionary: Record<number, string> = {
    0: 'Zero',
    1: 'One',
    2: 'Two',
    3: 'Three',
    4: 'Four',
    5: 'Five',
    6: 'Six',
    7: 'Seven',
    8: 'Eight',
    9: 'Nine',
    10: 'Ten',
    11: 'Eleven',
    12: 'Twelve',
    13: 'Thirteen',
    14: 'Fourteen',
    15: 'Fifteen',
    16: 'Sixteen',
    17: 'Seventeen',
    18: 'Eighteen',
    19: 'Nineteen',
    20: 'Twenty',
    30: 'Thirty',
    40: 'Fourty',
    50: 'Fifty',
    60: 'Sixty',
    70: 'Seventy',
    80: 'Eighty',
    90: 'Ninety',
    100: 'Hundred',
    1000: 'Thousand',
    1000000: 'Million',
    1000000000: 'Billion',
    1000000000000: 'Trillion',
    1000000000000000: 'Quadrillion',
  };

  if (isNaN(num)) {
    return "";
  }

  if (num < 0) {
    return 'Negative ' + convertNumberToWords(Math.abs(num));
  }

  let str = '';
  let fraction = '';

  const numStr = String(num);
  if (numStr.indexOf('.') !== -1) {
    const parts = numStr.split('.');
    num = parseInt(parts[0], 10);
    fraction = parts[1];
  }

  if (num < 21) {
    str = dictionary[num] || "";
  } else if (num < 100) {
    const tensKey = Math.floor(num / 10) * 10;
    const units = num % 10;
    str = dictionary[tensKey];
    if (units) {
      str += '-' + dictionary[units];
    }
  } else if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    str = dictionary[hundreds] + ' ' + dictionary[100];
    if (remainder) {
      str += ' ' + convertNumberToWords(remainder);
    }
  } else {
    const baseUnit = Math.pow(1000, Math.floor(Math.log10(num) / 3));
    const numBaseUnits = Math.floor(num / baseUnit);
    const remainder = num % baseUnit;
    str = convertNumberToWords(numBaseUnits) + ' ' + dictionary[baseUnit];
    if (remainder) {
      str += (remainder < 100 ? ' ' : ', ') + convertNumberToWords(remainder);
    }
  }

  if (fraction && !isNaN(Number(fraction))) {
    str += " ";
    const words: string[] = [];
    let fracNum = parseInt(fraction, 10);
    if (fracNum < 10 && fraction.length === 1) {
      fracNum = fracNum * 10;
      words.push(dictionary[fracNum]);
    } else {
      for (const char of fraction) {
        words.push(dictionary[parseInt(char, 10)]);
      }
    }
    str += words.join(' ');
  }

  return str;
}

/**
 * Converts a float number to Indian currency format words (Rupees and Paise).
 */
export function getIndianCurrency(amount: number): string {
  const no = Math.floor(amount);
  const decimal = Math.round((amount - no) * 100);
  let digitsLength = String(no).length;
  let i = 0;
  const str: string[] = [];
  const words: Record<number, string> = {
    0: '',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
    11: 'eleven',
    12: 'twelve',
    13: 'thirteen',
    14: 'fourteen',
    15: 'fifteen',
    16: 'sixteen',
    17: 'seventeen',
    18: 'eighteen',
    19: 'nineteen',
    20: 'twenty',
    30: 'thirty',
    40: 'forty',
    50: 'fifty',
    60: 'sixty',
    70: 'seventy',
    80: 'eighty',
    90: 'ninety'
  };

  const digits = ['', 'hundred', 'thousand', 'lakh', 'crore'];
  let tempNo = no;
  while (i < digitsLength) {
    const divider = (i === 2) ? 10 : 100;
    const numPart = Math.floor(tempNo % divider);
    tempNo = Math.floor(tempNo / divider);
    i += (divider === 10) ? 1 : 2;

    if (numPart) {
      const counter = str.length;
      const plural = (counter && numPart > 9) ? '' : '';
      const hundred = (counter === 1 && str[0]) ? '' : '';
      
      const digitLabel = digits[counter] ? ' ' + digits[counter] : '';
      
      if (numPart < 21) {
        str.push(words[numPart] + digitLabel + plural + ' ' + hundred);
      } else {
        const tensKey = Math.floor(numPart / 10) * 10;
        const unitsKey = numPart % 10;
        const unitWord = unitsKey ? ' ' + words[unitsKey] : '';
        str.push(words[tensKey] + unitWord + digitLabel + plural + ' ' + hundred);
      }
    } else {
      str.push('');
    }
  }

  const rupeesStr = str.reverse().join('').trim();
  let paiseStr = '';
  if (decimal > 0) {
    const decTens = Math.floor(decimal / 10) * 10;
    const decUnits = decimal % 10;
    const decWord = decUnits ? ' ' + words[decUnits] : '';
    paiseStr = ' and ' + words[decTens] + decWord + ' Paise';
  }

  const result = (rupeesStr ? rupeesStr.replace(/\s+/g, ' ') + ' Rupees' : '') + paiseStr;
  return result ? result.charAt(0).toUpperCase() + result.slice(1) : '';
}

/**
 * Converts a custom date string to standard MySQL format (YYYY-MM-DD).
 */
export function convertToMysqlDateFormat(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const cleanStr = dateStr.replace(/\//g, '-').trim();
  const time = Date.parse(cleanStr);
  if (isNaN(time)) {
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return dateStr;
  }
  const d = new Date(time);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a MySQL or system date format to system standard YYYY-MM-DD date string.
 */
export function convertToSystemDateFormat(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().split('T')[0];
}

/**
 * Generates a GUID / UUID string.
 */
export function guid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Converts string space-separated name to snake case format.
 */
export function convertToSnakeCase(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase().replace(/\s+/g, '_');
}
