import UpcoApp from '../components/upco/upco-app';
import { requireUser } from '@/lib/auth';

export default async function Home() {
  const user = await requireUser();
  return <UpcoApp user={user} />;
}
