import { format } from 'date-fns';

export interface Props {
  className?: string;
  date: Date | string | number;
}

/**
 * Display a formatted date in the user's timezone.
 */
export default function FormattedDate(props: Props) {
  const date = new Date(props.date);
  return (
    <time className={props.className} dateTime={date.toISOString()}>
      {format(date, 'yyyy-MM-dd HH:mm')}
    </time>
  );
}
