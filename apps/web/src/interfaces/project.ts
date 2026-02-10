import { ProjectType } from "../enums";
import { Scene } from "./scene";

type Inspiration = {
    _id: string;
    projectId: string;
    title: string;
    image: string;
    video: string;
    note: string;
    links: string[];
}

export interface Project {
    id: string;
    displayName: string;
    email: string;
    created_date: string;
    modified_date: string;
    revision: number;
    user: string;
    sharedWith: string[];
    type: ProjectType;
    genre: string;
    title: string;
    logline: string;
    budget: number;
    timePeriod: string;
    similarProjects: string[];
    inspiration: Inspiration[];
    outlineName?: string;
    poster?: string;
    scenes: Scene[];
}

export interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

export interface CreateProjectProps {
    setAddProject: Function
    handleAddProject: Function
}