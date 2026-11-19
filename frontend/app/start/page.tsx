import { redirect } from 'next/navigation';

/** The old title screen: everything on it now lives on the dashboard. */
export default function StartPage() {
  redirect('/dashboard');
}
