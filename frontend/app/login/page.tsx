import { AuthForm } from '@/components/menus/AuthForm';

export const metadata = { title: 'Log in — Harvest Valley' };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
