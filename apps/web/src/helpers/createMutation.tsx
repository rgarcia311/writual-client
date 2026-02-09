import { useMutation, useQueryClient }  from "@tanstack/react-query";
import { request } from "graphql-request";
import { Mutation } from "@/interfaces/scene"
import { sceneStore } from '@/state/sceneState';

import { GRAPHQL_ENDPOINT } from '@/lib/config';

const endpoint = GRAPHQL_ENDPOINT


export const createMutation = (updateMutationArgs: Mutation) => {
    const { createStatement, createVariables, invalidateQueriesArray, stateResetters } = updateMutationArgs
    const queryClient = useQueryClient()
    //const setVersionOptions = sceneStore((state) => state.setVersionOptions)

    return useMutation({
        mutationFn: async () => {
          await request(endpoint, createStatement, createVariables)
          console.log('createVariables: ', createVariables)
        },
        onSuccess: () =>  {
            queryClient.invalidateQueries({ queryKey: invalidateQueriesArray })
            queryClient.refetchQueries({ queryKey: invalidateQueriesArray })
            
            if(stateResetters) {
                stateResetters.setCreateStatement("")
                stateResetters.setCreateVariables({})
                stateResetters.setVersionOptions?.([])
                stateResetters.setNewVersion?.(false)

            }
            

        },
        onError: (_error: any) => {},
        onMutate: () => {}
      })
}