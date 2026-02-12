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
    setAddProject: (open: boolean) => void;
    handleAddProject: (formValues: Record<string, unknown>) => void;
    /** When set, form is in update mode: title "Update Project", prefilled, submit calls handleUpdateProject */
    initialData?: Record<string, unknown> | null;
    handleUpdateProject?: (formValues: Record<string, unknown>) => void;
}