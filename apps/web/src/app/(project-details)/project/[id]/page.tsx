'use client';

import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Checkbox, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Menu, MenuItem, MenuList, Paper, Tab, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TablePagination, TableRow, TableSortLabel, Tabs, TextField, Typography } from '@mui/material'
import React, { useEffect, useState } from 'react'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import  { CharacterCard } from '@/components/CharacterCard'
import { StepTabs } from '@/components/StepTabs';
import { CustomTabPanel } from '@/shared/CustomTabPanel';
import { sceneStore } from '@/state/sceneState';
import { useDebounce } from 'hooks';
import { CREATE_SCENE, UPDATE_SCENE } from 'mutations/SceneMutations'
import { Scene, Mutation, Version} from "@/interfaces/scene"
import { useCreateMutation } from 'hooks';
import { createMutation } from '@/helpers/createMutation';
import { GqlStatements } from '@/enums/GqlStatements';
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from 'graphql-request';
import { ProjectHeader } from '@/components/ProjectHeader';
import { ScratchPadCard } from '@/components/ScratchPadCard';
import type { ScratchPadCardData, ScratchPadCardType, MoveToDestination } from '@/components/ScratchPadCard/types';
import { addInspiration, deleteInspiration } from '../../../actions/inspirations';
import { PROJECT_QUERY } from '@/queries/ProjectQueries';
import { GRAPHQL_ENDPOINT } from '@/lib/config';
import { useUserProfileStore } from '@/state/user';
import type { Project } from '@/interfaces/project';
// Use dynamic import to avoid SSR issues with react-player's use of window.
import dynamic from 'next/dynamic';
const ReactPlayer = dynamic(() => import('react-player').then((mod) => mod.default as unknown as React.ComponentType<any>), {
  ssr: false,
});

const endpoint = GRAPHQL_ENDPOINT;

export default function Project() {
    const setEditMode = sceneStore((state) => state.setEditMode)
    const activeStep = sceneStore((state) => state.activeStep)
    const setActiveStep = sceneStore((state) => state.setActiveStep)
    const setActiveScene = sceneStore((state) => state.setActiveScene)
    const activeVersion = sceneStore(state => state.activeVersion)
    const setActiveVersion = sceneStore((state) => state.setActiveVersion)
    const setNewVersion = sceneStore((state) => state.setNewVersion)
    const setHandleSave = sceneStore((state) => state.setHandleSave)
    const createStatement = sceneStore((state) => state.createStatement)
    const setCreateStatement = sceneStore((state) => state.setCreateStatement)

    const versionOptions = sceneStore((state) => state.versionOptions)
    const setVersionOptions = sceneStore((state) => state.setVersionOptions)

    const [sceneContent, setSceneContent] = useState()
    //const setSceneContent = sceneStore((state) => state.setSceneContent)

    const [ createVariables, setCreateVariables ] = useState<any>()
    const [expandedTop, setExpandedTop] = useState(true)
    const [expandedBottom, setExpandedBottom] = useState(true)
    const [characters, setCharacters] = useState([])
    const [scenes, setScenes] = useState<Array<Scene>>([])
    const [value, setValue] = useState(0);
    const [bottomValue, setBottomValue] = useState(0);
    const [title, setTitle] = useState("")
    const [act, setAct] = useState<number>(0)
    const [scratchPadCards, setScratchPadCards] = useState<ScratchPadCardData[]>([])
    const [addCardAnchor, setAddCardAnchor] = useState<null | HTMLElement>(null)
    const [inspirationFormOpen, setInspirationFormOpen] = useState(false);
    const [inspirationTitle, setInspirationTitle] = useState('');
    const [inspirationImage, setInspirationImage] = useState('');
    const [inspirationVideo, setInspirationVideo] = useState('');
    const [inspirationNote, setInspirationNote] = useState('');
    const [inspirationLinks, setInspirationLinks] = useState('');
    const params = useParams()
    const id = params.id as string | undefined
    const queryClient = useQueryClient();

    const [projectData, setProjectData] = useState<Project | null>(null);

    const fetchProject = async (): Promise<{ getProjectData: Project[] }> => {
        const { userProfile } = await useUserProfileStore.getState();
        const variables = { input: { user: userProfile?.user, _id: id } };
        return request(endpoint, PROJECT_QUERY, variables);
    };

    const { data } = useQuery({
        queryKey: ['project', id],
        queryFn: () => fetchProject(),
        enabled: Boolean(id),
    });

    useEffect(() => {
        if (data?.getProjectData?.length) {
            setProjectData(data.getProjectData[0] as Project);
        } else {
            setProjectData(null);
        }
    }, [data]);

    const updateMutationArgs: Mutation = {
        createStatement: UPDATE_SCENE,
        createVariables: createVariables, 
        invalidateQueriesArray: ['projects'],
        stateResetters: {
            setCreateStatement,
            setCreateVariables,
            setVersionOptions,
            setNewVersion
        }
    }


    const createMutationArgs: Mutation = {
        createStatement: CREATE_SCENE,
        createVariables: createVariables, 
        invalidateQueriesArray: ['projects'],
        stateResetters: {
            setCreateStatement,
            setCreateVariables
        }
    }


    const createSceneMutation = createMutation(createMutationArgs)
    useCreateMutation(createStatement, createVariables, createSceneMutation, GqlStatements.CREATE_SCENE)

    const updateSceneMutation = createMutation(updateMutationArgs)
    useCreateMutation(createStatement, sceneContent, updateSceneMutation, GqlStatements.UPDATE_SCENE)

    const handleSave = useDebounce((
            newVersion: boolean,
            newScene: boolean,
            projectId: string,
            number: number,
            newVersionDisplay: number,
            step: string,
            updateKey: string,
            value: string) => {

        if(newScene) {
           
            setCreateStatement(CREATE_SCENE)
            setCreateVariables({
                act,
                projectId,
                newVersion,
                number,
                activeVersion,
                newScene,
                versions: [{
                act,
                [updateKey]: value,
                step,
            }]})
        } /*else {
            //set newVersion correctly
            setCreateStatement(UPDATE_SCENE)
            
            setCreateVariables({act, projectId, number, versions: [{
                ...sceneContent,
                newVersion,
                version: newVersion ? newVersionDisplay + 1  : sceneContent.version,
                thesis: sceneContent.thesis
            }]})
        }*/
    })

    useEffect(() => {
        setHandleSave(handleSave)
    }, [handleSave])

    const handleBottomChange = (event: React.SyntheticEvent, newValue: number) => {
        event.stopPropagation()
        setBottomValue(newValue);
    };

    const handleActChange = (event: React.SyntheticEvent, newValue: number) => {
        event.stopPropagation()
        setAct(newValue);
    };

    const handleChange = (event: React.SyntheticEvent, newValue: number) => {
        event.stopPropagation()
        setValue(newValue);
    };

    const toggleAccordionTop = () => {
        setExpandedTop(!expandedTop)
    }

    const toggleAccordionBottom = () => {
        setExpandedBottom(!expandedBottom)
    }

    function a11yProps(index: number) {
        return {
          id: `simple-tab-${index}`,
          'aria-controls': `simple-tabpanel-${index}`,
        };
    }

    const actTabProps = (index: number) => {
        return {
            id: `simple-tab=${index}`,
            'aria-controls': `simple-tabpanel-${index}`
        }
    }

    const handleAddScene = (act: number) => {
        setActiveScene(scenes.length + 1)
        //setNewVersion(true)

        const newVersion: Scene = {
            newScene: true,
            number: scenes.length + 1,
            activeVersion: 1,
            projectId: id as string,
            versions: [{
                act,
                antithesis: "",
                synopsis: "",
                synthesis: "",
                thesis: "",
                version: 1,
                sceneHeading: "",
                step: activeStep, 
                locked: false
            }]
        }

        setScenes([...scenes, newVersion])
    }

    const handleAddCharacter = () => {

    }

    const handleAddScratchPadCard = (type: ScratchPadCardType) => {
        setScratchPadCards((prev) => [...prev, {
            id: `local-${Date.now()}`,
            type,
            text: type === 'note' ? '' : undefined,
        }])
        setAddCardAnchor(null)
    }

    const handleMoveScratchPadTo = (destination: MoveToDestination) => {
        // TODO: wire to actual move (e.g. copy to section, then optionally remove from scratch pad)
    } 

    const outline = {
        name: "Hero's Journey",
        acts: [ 
            {
                
                label: "Act 1",
                steps: [
                    {
                        stepName: "Ordinary World",
                        stepDetails: "The start",
                        stepAct: 1
                    },
                    {
                        stepName: "Call To Adventure",
                        stepDetails: "The start",
                        stepAct: 1
                    },
                    {
                        stepName: "Refusal",
                        stepDetails: "The start",
                        stepAct: 1
                    },
                    {
                        stepName: "Meeting the Mentor",
                        stepDetails: "The start",
                        stepAct: 1
                    },
                    {
                        stepName: "Threshold",
                        stepDetails: "The start",
                        stepAct: 1
                    }
                ]
                
            },
            {
                label: "Act 2",
                steps: [

                ]
            }

            
        ],
        
    }

    console.log({ projectData });

    return (
        <Container maxWidth={false} disableGutters sx={{ display: "flex",  flexDirection: "column", flex: 1, padding: 2, height: "100%", width: "100%"}}>

            <ProjectHeader />

            <Container maxWidth={false} disableGutters sx={{ flex: 1, width: "100%", paddingTop: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    <Typography variant="h6" fontWeight={600}>Inspiration</Typography>
                    <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setInspirationFormOpen(true)}
                    >
                        Add inspiration
                    </Button>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
                    {Array.isArray((projectData as any)?.inspiration) &&
                        (projectData as any).inspiration.map((item: any) => (
                            <Paper 
                                elevation={2}
                                key={item._id}
                                sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, position: 'relative' }}
                            >
                                <Typography variant="subtitle1" fontWeight={600}>
                                    {item.title}
                                </Typography>
                                {item.image && (
                                    <Box sx={{ mt: 1 }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={item.image}
                                            alt={item.title}
                                            style={{ width: '100%', borderRadius: 4, objectFit: 'cover' }}
                                        />
                                    </Box>
                                )}
                                {item.video && !item.image && (
                                    <Box sx={{ mt: 1, position: 'relative'}}>
                                        <iframe width="100%" height="100%" src={item.video} title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ></iframe>
                                    </Box>
                                )}
                                {item.note && (
                                    <Typography variant="body2" sx={{ mt: 1 }}>
                                        {item.note}
                                    </Typography>
                                )}
                                {item.links && item.links.length > 0 && (
                                    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                        {item.links.map((link: string, idx: number) => (
                                            <Typography
                                                key={idx}
                                                variant="body2"
                                                component="a"
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{ color: 'primary.main', textDecoration: 'underline', wordBreak: 'break-all' }}
                                            >
                                                {link}
                                            </Typography>
                                        ))}
                                    </Box>
                                )}
                                <IconButton
                                    size="small"
                                    aria-label="Delete inspiration"
                                    onClick={async () => {
                                        if (!id || !item._id) return;
                                        const ok = window.confirm('Delete this inspiration item?');
                                        if (!ok) return;
                                        await deleteInspiration(id as string, item._id as string);
                                        await queryClient.invalidateQueries({ queryKey: ['project', id] });
                                    }}
                                    sx={{
                                        position: 'absolute',
                                        right: 8,
                                        bottom: 8,
                                    }}
                                >
                                    <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                            </Paper>
                        ))}
                </Box>
            </Container>
            <Dialog open={inspirationFormOpen} onClose={() => setInspirationFormOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>Add inspiration</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Title
                        </Typography>
                        <TextField
                            placeholder="Add a title"
                            value={inspirationTitle}
                            onChange={(e) => setInspirationTitle(e.target.value)}
                            fullWidth
                            variant="outlined"
                            required
                        />
                    </Box>
                    <TextField
                        label="Image URL"
                        value={inspirationImage}
                        onChange={(e) => setInspirationImage(e.target.value)}
                        fullWidth
                    />
                    <TextField
                        label="Video URL"
                        value={inspirationVideo}
                        onChange={(e) => setInspirationVideo(e.target.value)}
                        fullWidth
                    />
                    <TextField
                        label="Note"
                        value={inspirationNote}
                        onChange={(e) => setInspirationNote(e.target.value)}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                    <TextField
                        label="Links (comma separated)"
                        value={inspirationLinks}
                        onChange={(e) => setInspirationLinks(e.target.value)}
                        fullWidth
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setInspirationFormOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={async () => {
                            if (!id || !inspirationTitle.trim()) return;
                            const links =
                                inspirationLinks
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean) ?? [];
                            await addInspiration({
                                projectId: id as string,
                                title: inspirationTitle.trim(),
                                image: inspirationImage.trim() || undefined,
                                video: inspirationVideo.trim() || undefined,
                                note: inspirationNote.trim() || undefined,
                                links,
                            });
                            await queryClient.invalidateQueries({ queryKey: ['project', id] });
                            setInspirationFormOpen(false);
                            setInspirationTitle('');
                            setInspirationImage('');
                            setInspirationVideo('');
                            setInspirationNote('');
                            setInspirationLinks('');
                        }}
                        disabled={!inspirationTitle.trim()}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
       
    )
}