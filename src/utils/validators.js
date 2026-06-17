// ============================================================
//  validators.js — Validación de formularios e inputs
// ============================================================

export function isNonEmpty(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isPositiveNumber(v) {
  const n = Number(v);
  return !isNaN(n) && n > 0;
}

export function isValidLength(v, min, max) {
  const len = String(v || '').length;
  return len >= min && len <= max;
}

export function isOnlyDigits(v) {
  return /^\d+$/.test(String(v || ''));
}

export function sanitizePhone(v) {
  return String(v || '').replace(/[^\d+]/g, '');
}

// Valida un formulario completo según reglas. Devuelve { valid, errors }
export function validateForm(fields, rules) {
  const errors = {};
  for (const [key, rule] of Object.entries(rules)) {
    const value = fields[key];
    if (rule.required && !isNonEmpty(value)) {
      errors[key] = `${rule.label || key} es obligatorio`;
      continue;
    }
    if (rule.minLength && !isValidLength(value, rule.minLength, rule.maxLength || Infinity)) {
      errors[key] = `${rule.label || key} debe tener entre ${rule.minLength} y ${rule.maxLength} caracteres`;
    }
    if (rule.positiveNumber && !isPositiveNumber(value)) {
      errors[key] = `${rule.label || key} debe ser un número positivo`;
    }
    if (rule.digitsOnly && value && !isOnlyDigits(value)) {
      errors[key] = `${rule.label || key} solo debe contener números`;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
