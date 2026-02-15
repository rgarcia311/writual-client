import { request } from 'graphql-request';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { PROJECTS_QUERY } from '@/queries/ProjectQueries';
import { Box, Typography } from '@mui/material';
import { Projects } from '@/components/Projects';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { cookies } from 'next/headers';

const endpoint = GRAPHQL_ENDPOINT;

export default async function ProjectsPage() {
    const userId = (await cookies()).get("user-id")?.value;
    
    if(userId) {

        try {
            console.log({ userId });
            const queryClient = new QueryClient();
            await queryClient.prefetchQuery(
                { 
                    queryKey: ['projects', userId], 
                    queryFn: async () => request(endpoint, PROJECTS_QUERY, { input: { user: userId }})
                })
            const dehydratedState = dehydrate(queryClient);

            return (
                <HydrationBoundary state={dehydratedState}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                        <Typography fontFamily={'Merriweather'} letterSpacing={5} fontSize={28} fontWeight={700} color="primary">Projects</Typography>
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
