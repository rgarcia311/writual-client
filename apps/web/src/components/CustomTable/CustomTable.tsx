'use client';

import React, { useReducer, useState } from 'react';
import {
    Button,
    TableContainer,
    Table,
    TableFooter,
    TablePagination,
    Paper,
    Container,
    IconButton, Typography
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SettingsIcon from '@mui/icons-material/Settings';
import { useRouter } from 'next/navigation'
import { CustomTableHead } from './TableHeader';
import { CustomTableBody } from './TableBody';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { TableProps, Data } from 'interfaces';
import { tableBodyStyle } from 'styles';
import InboxIcon from '@mui/icons-material/Inbox';
import { Order } from '@/types/types'
import { DataGrid, GridColDef } from '@mui/x-data-grid';

export const CustomTable: React.FC<TableProps> = ({ 
    label, 
    headerCells, 
    rows, 
    defaultSortColumn, 
    setAddProject,
     }) => {
    const theme = useTheme()
    const [order, setOrder] = React.useState<Order>('asc');
    const [orderBy, setOrderBy] = React.useState(defaultSortColumn);
    const [selected, setSelected] = React.useState<readonly string[]>([]);
    const [currentPage, setPage] = React.useState(0);
    const [dense, setDense] = React.useState(false);
    const [sortOrder, setSortOrder] = React.useState<any>('desc');
    const [currentSortedColumn, setCurrentSortedColumn] = React.useState(defaultSortColumn);
    const [currentPageSize, setRowsPerPage] = React.useState(10);
    const [openSort, setOpenSort] = React.useState(false)
    const [manageColumns, setOpenManageColumns] = React.useState(false)
    const [currentCell, setCurrentCell] = React.useState("")
    const [edit, setEditProject]  =  React.useState(false)
    const [currentProject, setCurrentProject] = React.useState("") 
    const [hoverLabel, setHoverLabel] = React.useState("")
    const [mcAnchorEl, setMCAnchorEl] = React.useState(null);
    const [filterAnchorEl, setFilterAnchorEl] = React.useState(null)
    const [showAll, setShowAll] = useState(true)

    const router = useRouter()



    const openManageColumns = Boolean(mcAnchorEl);
    const manageColumnsId = openManageColumns ? 'manage-columns-popover' : undefined;
    const openFilter = Boolean(filterAnchorEl);
    const filterId = openFilter ? 'filter-status-popover' : undefined;

    const columns: GridColDef<(typeof rows)[number]>[] = [
    { 
        field: 'title', 
        headerName: 'Title', 
        flex: 1 
    },
    {
        field: 'logline',
        headerName: 'Logline',
        editable: true,
        flex: 1 

    },
    {
        field: 'genre',
        headerName: 'Genre',
        flex: 1,
        editable: true,
    },
    {
        field: 'type',
        headerName: 'Type',
        description: 'This column has a value getter and is not sortable.',
        sortable: false,
        flex: 1
    },
    {
        field: 'progress',
        headerName: 'Progress',
        flex: 1,
        editable: true,
    },
    {
        field: 'user',
        headerName: 'Author',
        flex: 1,
        editable: true,
    },
    {
        field: 'outline',
        headerName: 'Outline',
        flex: 1,
        editable: true,
    },
    ];

    const isSelected = (tcn: string) => selected.indexOf(tcn) !== -1;

    const handleRecordClick  = (e: any, id: string) => {
        e.preventDefault()
        e.stopPropagation()
        router.push(`/project/${id}`)
    }

    return (
        <Paper elevation={0} sx={{ ...tableBodyStyle.paper, backgroundColor: theme.palette.body.main, border: "1px solid orange" }}>
            <Container disableGutters maxWidth={false} sx={{...tableBodyStyle.tableTopButtons, border: "1px solid purple", backgroundColor: theme.palette.body.main}}>
                <Container disableGutters sx={tableBodyStyle.topContainer}>
                    <Typography variant="h6">PROJECTS</Typography>
                    <Button 
                        onClick={() => setAddProject(true)} 
                        color="primary" 
                        variant='text' 
                        sx={tableBodyStyle.buttonStyle} 
                        startIcon={<AddCircleOutlineIcon />}>
                        Create Project
                    </Button>
                </Container>
                
                <Container disableGutters maxWidth={false}  sx={{width: "max-content", margin: 0, border: "1px solid yellow"}}>
                   
                    <IconButton sx={tableBodyStyle.iconContainer}>
                        <SettingsIcon aria-label="Settings" />
                    </IconButton>
                </Container>
               

            </Container>

            <DataGrid rows={rows} columns={columns} />
                
        </Paper>

    )
}
