import { format } from 'date-fns';
import { TZDate } from '@date-fns/tz';

export interface Props {
  className?: string;
  date: Date | string | number;
}

/**
 * Display a formatted date in the user's timezone.
 */
export default function FormattedDate(props: Props) {
  const date = new TZDate(new Date(props.date), 'Asia/Tokyo');

  return (
    <time className={props.className} dateTime={date.toISOString()}>
      {format(date, 'yyyy-MM-dd')}
    </time>
  );
}
