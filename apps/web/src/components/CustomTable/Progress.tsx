import React from "react"
import { Paper } from '@mui/material';
import PeopleAltTwoToneIcon from '@mui/icons-material/PeopleAltTwoTone';
import TheatersTwoToneIcon from '@mui/icons-material/TheatersTwoTone';
import { useTheme } from '@mui/material/styles';

export const Progress: React.FC<any> =  ({characters, scenes}) => {
    const theme = useTheme()

    return (
      <Paper sx={{boxShadow: "none", display: "flex", width: "100%", justifyContent: "space-between"}}>
        <PeopleAltTwoToneIcon color="taxi"/>
        <TheatersTwoToneIcon  sx={{ color: theme.palette.scifi.main}}/>
      </Paper>
    )
  }