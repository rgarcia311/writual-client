
import { Suspense } from 'react';
import { request } from "graphql-request";
import { dehydrate, HydrationBoundary, QueryClient, } from "@tanstack/react-query";
import { PROJECTS_QUERY } from '@/queries/ProjectQueries';
import { Box, Container, Typography } from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';
import { SettingsPopover } from '@/components/SettingsPopover';
import { Projects } from '@/components/Projects';

import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { cookies } from 'next/headers';
import { auth } from 'firebase-admin';
import { adminAuth } from '@/lib/firebase-admin';

const endpoint = GRAPHQL_ENDPOINT;

export default async function DataTable() {
    const userId = (await cookies()).get("user-id")?.value;
    
    if(userId) {

        try {
            console.log({ userId });
            const queryClient = new QueryClient();
            await queryClient.prefetchQuery(
                { 
                    queryKey: ['projects'], 
                    queryFn: async () => request(endpoint, PROJECTS_QUERY, { input: { user: userId }})
                })
            const dehydratedState = dehydrate(queryClient);

            return (
        
                <HydrationBoundary state={dehydratedState}>
                
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
    
                        <Container sx={{ 
                            minWidth: "100%", 
                            display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 1, marginTop: "10px", textAlign: "center", height: "70px", textDecoration: "none", color: "inherit" }}>
                            <Link href="/projects" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
                            <Image src="/logo_symbol.png" alt="Writual" width={65} height={65} loading="lazy" />
                            <Typography letterSpacing={3} variant="h6" color="primary" fontSize={32}>ritual</Typography>
                            </Link>
                        </Container>
                        <Box sx={{ position: 'fixed', bottom: 16, left: 16, zIndex: 1200 }}>
                            <SettingsPopover standalone />
                        </Box>
    
                        <Projects />
                
    
                    </Box>
                
                </HydrationBoundary>
            
        );

        } catch (e) {
            console.log('error validating session: ', e);
            // Clear invalid cookie (e.g. old ID token) so next sign-in sets a proper session cookie
            return <div>Session expired or invalid.</div>;
        }

    }
  
    
}
