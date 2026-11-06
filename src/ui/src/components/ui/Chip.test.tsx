import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Chip, OverdueChip } from './Chip';
import { CHIP_TONES } from './chipTones';

describe('Chip', () => {
  it('renders every tone class of the design system with its label text', () => {
    render(
      <>
        {CHIP_TONES.map((tone) => (
          <Chip key={tone} tone={tone}>
            {tone}
          </Chip>
        ))}
      </>,
    );
    for (const tone of CHIP_TONES) {
      expect(screen.getByText(tone)).toHaveClass('ciq-chip', `ciq-chip--${tone}`);
    }
  });

  it('marks overdue items with an outlined danger chip', () => {
    render(<OverdueChip />);
    expect(screen.getByText('Overdue')).toHaveClass('ciq-chip--danger', 'ciq-chip--outlined');
  });
});
