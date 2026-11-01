// The barbering affects the odds, while the final seat assignment is playful.
export function verdictFor(progress, cutCount, random = Math.random) {
  const chance = cutCount ? .16 : progress >= 92 ? .82 : .38;
  const invited = random() < chance;
  const lines = cutCount
    ? invited
      ? [
        'The bandage counts as wedding decor. Aakash says you’re in.',
        'A tiny nick, a huge comeback. Your seat is somehow still safe.',
      ]
      : [
        'Aakash requested a shave, not a crime scene. Try again.',
        'The razor won this round. Your invitation is at the first-aid desk.',
      ]
    : progress >= 92
      ? invited
        ? [
          'Smooth work. Aakash has reserved you a seat near the dessert table.',
          'The groom approves. Your invitation is officially smoother than his chin.',
        ]
        : [
          'Great shave. The seating chart, however, has developed a personality.',
          'Aakash looks fantastic. The random wedding committee says try again.',
        ]
      : invited
        ? [
          'The beard is still there, but the wedding committee loves confidence. You’re in.',
          'An unfinished shave and a surprise invitation. Plot twist!',
        ]
        : [
          'There is still a beard situation. Back to the chair!',
          'Aakash has more beard than patience. Give it another pass.',
        ];
  return { invited, copy: lines[Math.floor(random() * lines.length)] };
}
