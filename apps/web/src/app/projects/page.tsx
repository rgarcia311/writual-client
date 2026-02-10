
import { Suspense } from 'react';
import { request } from "graphql-request";
import { dehydrate, HydrationBoundary, QueryClient, } from "@tanstack/react-query";
import { PROJECTS_QUERY } from '@/queries/ProjectQueries';
import { Box, Container, Typography } from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                        <Typography fontFamily={'Merriweather'} letterSpacing={5} fontSize={28} fontWeight={700} color="primary">Projects</Typography>
                        {/*<Typography sx={{textDecoration: 'underline'}} fontFamily={'Varela Round'} letterSpacing={2} variant="h4" fontWeight={400} color="primary">Projects</Typography>
                        <Typography sx={{textDecoration: 'underline'}} fontFamily={'Lora'} letterSpacing={2} variant="h4" fontWeight={400} color="primary">Projects</Typography>
                        <Typography sx={{textDecoration: 'underline'}} fontFamily={'Manrope'} letterSpacing={2} variant="h4" fontWeight={400} color="primary">Projects</Typography>*/}
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
