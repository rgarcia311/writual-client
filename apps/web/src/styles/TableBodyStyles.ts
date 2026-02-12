export const tableBodyStyle = {
    cell: {
        paddingTop: "16px",
        paddingRight: "10px",
        paddingBottom: "16px",
        paddingLeft: "10px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        //display: "flex",
        //justifyContSent: "center",
        
    }, 
    row: { 
        cursor: "pointer", '&:last-child td, &:last-child th': { 
            border: 0 
        }
    },
    paper: {
        boxShadow: "none", 
        padding: 1, 
        //maxHeight: "calc(100% - 40px)", 
        display: "flex", 
        flexDirection: "column", 
        width: '100%'
    },
    container: { 
        minHeight: "70px", 
        maxWidth: "100%", 
        display: "flex", 
        alignItems: "center" 
    },
    topContainer: {
        display: "flex", 
        flexDirection: "row", 
        alignItems: "center", 
        margin: 0
    },
    genreChip: {
        borderRadius: 5, 
        //xwidth: "max-content", 
        height:  "max-content", 
        paddingLeft: "12px", 
        paddingRight: "12px", 
        paddingTop: "1px", 
        paddingBottom: "1px"
    },
    text: {
        overflow: "hidden",
        whiteSace: "nowrap",
        textOverflow: "ellipsis",
        cursor: "pointer"
    },
    buttonStyle: { 
        paddingLeft: "8px", 
        paddingTop: "11px", 
        paddingRight: "8px", 
        paddingBottom: "11px",
        minWidth: "189px", 
        height: "42px" 
    },
    iconContainer: {
        height: "40px",
        width: "40px",
        padding: "8px"
    },
    containerStyle: { 
        borderRadius: "10px", 
        minHeight:"calc(100vh - 200px)", 
        boxShadow: "none", 
        gap: 2
    },
    emptyTableContainer: {
        minWidth: "100%", 
        minHeight:"calc(100vh - 400px)", 
        display: "flex", 
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },
    tableTopButtons: {
        display: "flex",
        flexDirection: "row",
        height: "100%",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 1,
        marginBottom: "2px"
    },
    tableFooter: {
        backgroundColor:"white", 
        display: "flex", 
        justifyContent: "flex-end"
    }

}