'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { auth } from '@/lib/firebase';
import { authRequest } from '@/lib/authRequest';
import { CLAIM_INVITE } from '@/mutations/ShareMutations';

export default function InvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = React.useState<'loading' | 'claiming' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = React.useState('');

  React.useEffect(() => {
    if (!token) {
      router.replace('/');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Not authenticated — redirect to login preserving the full invite URL
        const redirectTo = encodeURIComponent(`/invite?token=${token}`);
        router.replace(`/?redirectTo=${redirectTo}`);
        return;
      }

      // Authenticated — claim the invite
      setStatus('claiming');
      try {
        const data = await authRequest<{ claimInvite: { _id: string } }>(CLAIM_INVITE, { token });
        router.replace(`/project/${data.claimInvite._id}`);
      } catch (err: any) {
        setErrorMessage(
          err?.response?.errors?.[0]?.message ??
          'This invite link is invalid or has already been used.'
        );
        setStatus('error');
      }
    });

    return () => unsubscribe();
  }, [token, router]);

  if (status === 'error') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2, p: 3 }}>
        <Alert severity="error" sx={{ maxWidth: 480 }}>
          {errorMessage}
        </Alert>
        <Button variant="outlined" onClick={() => router.replace('/')}>
          Go to Writual
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2 }}>
      <CircularProgress sx={{ color: '#2D8060' }} />
      <Typography color="text.secondary">
        {status === 'claiming' ? 'Claiming your invite…' : 'Loading…'}
      </Typography>
    </Box>
  );
}
