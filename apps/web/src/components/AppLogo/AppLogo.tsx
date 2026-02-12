'use client';

import * as React from 'react';
import Image from 'next/image';
import { Box, Typography } from '@mui/material';

export interface AppLogoProps {
  logoPath?: string;
  color?: string;
  size?: number;
  fontSize?: number;
  gap?: number;
  loading?: 'eager' | 'lazy';
}

export function AppLogo({
  size = 65,
  fontSize = 32,
  gap = 8,
  loading = 'lazy',
  color = 'primary',
  logoPath = '/logo_symbol_transparent.png',
}: AppLogoProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', }}>
      <Image src={logoPath} alt="Writual" width={size} height={size} loading={loading} />
      <Typography fontFamily='Merriweather' sx={{ marginLeft: '2px'}} letterSpacing={5} fontSize={25} color={color}>
        ritual
      </Typography>
    </Box>
  );
}

