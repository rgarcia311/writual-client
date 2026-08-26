'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { request } from 'graphql-request';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { getFirebaseAuth } from '@/lib/firebase';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { ME_QUERY } from '@/queries/UserQueries';
import { FINALIZE_SIGNUP } from '@/mutations/ShareMutations';
import { authRequest } from '@/lib/authRequest';
import { useUserProfileStore } from '@/state/user';
import { verifyAndLogin } from '@/app/actions/auth';
import { TierCard } from './TierCard';
import {
  IS_FREE_PRICING_BLOCK,
  PRICING_TIERS,
  parseTierParam,
  type BillingCycle,
  type PricingTier,
} from '@/lib/pricing';

/** Drives both the button labels and whether the tier grid accepts clicks. */
type SignupPhase = 'idle' | 'signing-in' | 'redirecting';

const PHASE_LABEL: Record<Exclude<SignupPhase, 'idle'>, string> = {
  'signing-in': 'Signing in...',
  redirecting: 'Redirecting...',
};

interface MeQueryResult {
  me: {
    uid: string;
    name: string | null;
    displayName: string | null;
    tier: PricingTier['id'];
    settings: {
      colorMode: 'dark' | 'light';
      statTilePreferences?: Record<string, string[]> | null;
      walkthroughDismissed?: boolean;
    };
  };
}

function PricingTiersContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUserProfile = useUserProfileStore((s) => s.setUserProfile);

  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>('monthly');
  const [phase, setPhase] = React.useState<SignupPhase>('idle');
  const [pendingTier, setPendingTier] = React.useState<PricingTier['id'] | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const deepLinkedTier = parseTierParam(searchParams.get('tier'));

  // The auth guard and the sign-in handler both watch Firebase auth state. Without this flag the
  // guard would fire on the popup's own sign-in and race the handler's `/projects` redirect,
  // skipping `verifyAndLogin` (and therefore the chosen tier) entirely.
  const signingUpRef = React.useRef(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      if (user && !signingUpRef.current) {
        router.replace('/projects');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const isBusy = phase !== 'idle';

  const handleSelectTier = React.useCallback(
    async (tierId: PricingTier['id']) => {
      if (signingUpRef.current) return;

      signingUpRef.current = true;
      setPendingTier(tierId);
      setPhase('signing-in');
      setErrorMessage(null);

      try {
        const auth = getFirebaseAuth();
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        const idToken = await result.user.getIdToken();

        const verifyResult = await verifyAndLogin(idToken, tierId);
        if (verifyResult?.status !== 'success') {
          throw new Error(verifyResult?.error ?? 'Verification failed');
        }

        try {
          await authRequest(FINALIZE_SIGNUP);
        } catch (err) {
          // A failed finalize leaves a usable account; the server reconciles on the next login.
          console.error('Failed to finalize signup:', err);
        }

        setPhase('redirecting');

        // Read the profile back from the API rather than trusting the popup result, so the store
        // carries the tier and settings the backend actually recorded for this account.
        const data = await request<MeQueryResult>(
          GRAPHQL_ENDPOINT,
          ME_QUERY,
          { displayName: result.user.displayName, name: result.user.displayName },
          { Authorization: `Bearer ${idToken}` }
        );

        setUserProfile({
          user: result.user.uid,
          name: data.me.name,
          displayName: data.me.displayName ?? result.user.displayName,
          email: result.user.email,
          // BETA OVERRIDE: mirrors `ClientOnlyMuiLayout`, which forces top-tier access while in
          // beta. Restore `tier: data.me.tier` in both places together to bring back real gating.
          tier: 'beta-access',
          settings: data.me.settings,
        });

        router.replace('/projects');
      } catch (err) {
        const code = (err as { code?: string })?.code;
        // Closing the popup is a deliberate cancel, not a failure worth a red alert.
        if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
          console.error('Signup error:', err);
          setErrorMessage('Sign-up failed. Please try again.');
        }
        signingUpRef.current = false;
        setPendingTier(null);
        setPhase('idle');
      }
    },
    [router, setUserProfile]
  );

  return (
    <Box
      component="section"
      aria-label="Membership tiers"
      sx={{
        width: '100%',
        boxSizing: 'border-box',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        px: { xs: 2, md: 4 },
        py: { xs: 5, md: 7 },
      }}
    >
      <Box sx={{ textAlign: 'center', maxWidth: 640 }}>
        <Typography
          component="h1"
          variant="h3"
          sx={{ fontWeight: 700, fontSize: { xs: 32, md: 44 }, lineHeight: 1.1 }}
        >
          Choose your path.
        </Typography>
        <Typography sx={{ mt: 1.5, color: 'text.secondary', fontSize: { xs: 15, md: 18 } }}>
          Start free. Upgrade when you&apos;re ready.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          // The group is centred on its own; on md+ the chip is taken out of flow so its width
          // cannot push the group off centre. Below md it sits underneath instead, where an
          // out-of-flow chip would run past the viewport edge.
          position: 'relative',
          // Locked rather than unmounted during sign-in, so the layout does not shift mid-flow.
          pointerEvents: isBusy ? 'none' : 'auto',
          opacity: isBusy ? 0.6 : 1,
          transition: theme.transitions.create('opacity', {
            duration: theme.transitions.duration.short,
          }),
        }}
      >
        <ToggleButtonGroup
          value={billingCycle}
          exclusive
          size="small"
          aria-label="Billing cycle"
          onChange={(_event, next: BillingCycle | null) => {
            // MUI reports null when the active button is clicked again; keep the current cycle.
            if (next) setBillingCycle(next);
          }}
          sx={{
            // `secondary.main` is near-white in the light palette, so the default selected state
            // was unreadable. Primary carries the selection instead.
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              px: 2.5,
              color: 'text.primary',
              borderColor: 'divider',
              '&.Mui-selected': {
                color: 'primary.contrastText',
                backgroundColor: 'primary.main',
                '&:hover': { backgroundColor: 'primary.dark' },
              },
            },
          }}
        >
          <ToggleButton value="monthly">Monthly</ToggleButton>
          <ToggleButton value="yearly">Yearly</ToggleButton>
        </ToggleButtonGroup>
        {/* The yearly discount does not exist on a block where every tier is free. */}
        <Chip
          label={IS_FREE_PRICING_BLOCK ? 'Free during beta' : 'Save ~25%'}
          size="small"
          color="primary"
          variant="outlined"
          sx={{
            position: { xs: 'static', md: 'absolute' },
            left: { md: '100%' },
            top: { md: '50%' },
            transform: { md: 'translateY(-50%)' },
            ml: { md: 1.5 },
          }}
        />
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: { xs: 3, md: 3 },
          width: '100%',
          maxWidth: 1100,
          mt: { xs: 1, md: 2 },
          // Room for the featured card's scale-up, which would otherwise be clipped by the
          // root layout's `overflow: hidden` container.
          py: { xs: 0, md: 2 },
          pointerEvents: isBusy ? 'none' : 'auto',
        }}
      >
        {PRICING_TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            billingCycle={billingCycle}
            busy={pendingTier === tier.id}
            disabled={isBusy}
            busyLabel={isBusy ? PHASE_LABEL[phase as Exclude<SignupPhase, 'idle'>] : ''}
            highlighted={deepLinkedTier === tier.id}
            onSelect={handleSelectTier}
          />
        ))}
      </Box>

      <Box sx={{ textAlign: 'center', mt: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Cancel or downgrade anytime.
        </Typography>
      </Box>

      <Snackbar
        open={Boolean(errorMessage)}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

/**
 * Membership tier picker for signed-out visitors, rendered under the landing page content.
 *
 * `useSearchParams` opts the tree into client-side rendering, which Next requires a Suspense
 * boundary for. The fallback is deliberately empty — the section paints in one frame either way.
 */
export function PricingTiers() {
  return (
    <React.Suspense fallback={null}>
      <PricingTiersContent />
    </React.Suspense>
  );
}
