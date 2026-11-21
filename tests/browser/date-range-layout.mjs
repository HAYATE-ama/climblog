import assert from 'node:assert/strict';

export async function checkDateRangeLayout(group, stacked) {
  const [from, to] = await group.locator('input[type=date]').evaluateAll(inputs => inputs.map(input => {
    const rect = input.getBoundingClientRect();
    const label = input.closest('label').getBoundingClientRect();
    const card = input.closest('.card').getBoundingClientRect();
    const container = input.closest('fieldset') || input.closest('.dateRangeFields');
    const bounds = container.getBoundingClientRect();
    const style = getComputedStyle(container);
    const innerLeft = bounds.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
    const innerRight = bounds.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
    return {
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      labelTop: label.top, height: rect.height,
      contained: rect.left >= Math.max(0, label.left, card.left) - 1 &&
        rect.right <= Math.min(innerWidth, label.right, card.right) + 1,
      insidePadding: rect.left >= innerLeft - 1 && rect.right <= innerRight + 1,
    };
  }));
  for (const field of [from, to]) {
    assert.ok(field.contained, 'Date input should fit inside its label, card and viewport');
    assert.ok(field.insidePadding, 'Date input should leave room for its container padding');
    assert.ok(field.height >= 44, 'Date input should retain its tap target');
  }
  if (stacked) {
    assert.ok(to.labelTop >= from.bottom + 8, 'End date label should sit below the start date input');
  } else {
    assert.ok(Math.abs(from.top - to.top) <= 1 && to.left >= from.right + 8,
      'Dates should share one row with a visible gap');
  }
}
