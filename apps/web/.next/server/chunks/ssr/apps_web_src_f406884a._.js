module.exports=[36399,45106,34105,a=>{"use strict";var b=a.i(65886),c=a.i(2320),d=a.i(81310),e=a.i(23304),f=a.i(30340),g=a.i(50584),h=a.i(31820),i=a.i(13032),j=a.i(33391),k=a.i(97129),l=a.i(73976),m=a.i(94848),n=a.i(56223),o=a.i(39337),p=a.i(99220),q=a.i(43883),r=a.i(63624),s=a.i(49499),t=a.i(61857),u=a.i(25918),v=a.i(93588),w=a.i(77170),x=a.i(68083),y=a.i(21620),z=a.i(5247);function A(a){return(0,z.default)("MuiListItem",a)}(0,y.default)("MuiListItem",["root","container","dense","alignItemsFlexStart","divider","gutters","padding","secondaryAction"]);let B=(0,y.default)("MuiListItemButton",["root","focusVisible","dense","alignItemsFlexStart","disabled","divider","gutters","selected"]);function C(a){return(0,z.default)("MuiListItemSecondaryAction",a)}(0,y.default)("MuiListItemSecondaryAction",["root","disableGutters"]);let D=(0,r.styled)("div",{name:"MuiListItemSecondaryAction",slot:"Root",overridesResolver:(a,b)=>{let{ownerState:c}=a;return[b.root,c.disableGutters&&b.disableGutters]}})({position:"absolute",right:16,top:"50%",transform:"translateY(-50%)",variants:[{props:({ownerState:a})=>a.disableGutters,style:{right:0}}]}),E=c.forwardRef(function(a,d){let e=(0,t.useDefaultProps)({props:a,name:"MuiListItemSecondaryAction"}),{className:f,...g}=e,h=c.useContext(x.default),i={...e,disableGutters:h.disableGutters},j=(a=>{let{disableGutters:b,classes:c}=a;return(0,p.default)({root:["root",b&&"disableGutters"]},C,c)})(i);return(0,b.jsx)(D,{className:(0,o.default)(j.root,f),ownerState:i,ref:d,...g})});E.muiName="ListItemSecondaryAction";let F=(0,r.styled)("div",{name:"MuiListItem",slot:"Root",overridesResolver:(a,b)=>{let{ownerState:c}=a;return[b.root,c.dense&&b.dense,"flex-start"===c.alignItems&&b.alignItemsFlexStart,c.divider&&b.divider,!c.disableGutters&&b.gutters,!c.disablePadding&&b.padding,c.hasSecondaryAction&&b.secondaryAction]}})((0,s.default)(({theme:a})=>({display:"flex",justifyContent:"flex-start",alignItems:"center",position:"relative",textDecoration:"none",width:"100%",boxSizing:"border-box",textAlign:"left",variants:[{props:({ownerState:a})=>!a.disablePadding,style:{paddingTop:8,paddingBottom:8}},{props:({ownerState:a})=>!a.disablePadding&&a.dense,style:{paddingTop:4,paddingBottom:4}},{props:({ownerState:a})=>!a.disablePadding&&!a.disableGutters,style:{paddingLeft:16,paddingRight:16}},{props:({ownerState:a})=>!a.disablePadding&&!!a.secondaryAction,style:{paddingRight:48}},{props:({ownerState:a})=>!!a.secondaryAction,style:{[`& > .${B.root}`]:{paddingRight:48}}},{props:{alignItems:"flex-start"},style:{alignItems:"flex-start"}},{props:({ownerState:a})=>a.divider,style:{borderBottom:`1px solid ${(a.vars||a).palette.divider}`,backgroundClip:"padding-box"}},{props:({ownerState:a})=>a.button,style:{transition:a.transitions.create("background-color",{duration:a.transitions.duration.shortest}),"&:hover":{textDecoration:"none",backgroundColor:(a.vars||a).palette.action.hover,"@media (hover: none)":{backgroundColor:"transparent"}}}},{props:({ownerState:a})=>a.hasSecondaryAction,style:{paddingRight:48}}]}))),G=(0,r.styled)("li",{name:"MuiListItem",slot:"Container"})({position:"relative"}),H=c.forwardRef(function(a,d){let e=(0,t.useDefaultProps)({props:a,name:"MuiListItem"}),{alignItems:f="center",children:g,className:h,component:i,components:j={},componentsProps:k={},ContainerComponent:l="li",ContainerProps:{className:m,...n}={},dense:r=!1,disableGutters:s=!1,disablePadding:y=!1,divider:z=!1,secondaryAction:B,slotProps:C={},slots:D={},...H}=e,I=c.useContext(x.default),J=c.useMemo(()=>({dense:r||I.dense||!1,alignItems:f,disableGutters:s}),[f,I.dense,r,s]),K=c.useRef(null),L=c.Children.toArray(g),M=L.length&&(0,u.default)(L[L.length-1],["ListItemSecondaryAction"]),N={...e,alignItems:f,dense:J.dense,disableGutters:s,disablePadding:y,divider:z,hasSecondaryAction:M},O=(a=>{let{alignItems:b,classes:c,dense:d,disableGutters:e,disablePadding:f,divider:g,hasSecondaryAction:h}=a;return(0,p.default)({root:["root",d&&"dense",!e&&"gutters",!f&&"padding",g&&"divider","flex-start"===b&&"alignItemsFlexStart",h&&"secondaryAction"],container:["container"],secondaryAction:["secondaryAction"]},A,c)})(N),P=(0,v.default)(K,d),[Q,R]=(0,w.default)("secondaryAction",{elementType:E,externalForwardedProps:{slots:D,slotProps:C},ownerState:N,className:O.secondaryAction}),S=D.root||j.Root||F,T=C.root||k.root||{},U={className:(0,o.default)(O.root,T.className,h),...H},V=i||"li";return M?(V=U.component||i?V:"div","li"===l&&("li"===V?V="div":"li"===U.component&&(U.component="div")),(0,b.jsx)(x.default.Provider,{value:J,children:(0,b.jsxs)(G,{as:l,className:(0,o.default)(O.container,m),ref:P,ownerState:N,...n,children:[(0,b.jsx)(S,{...T,...!(0,q.default)(S)&&{as:V,ownerState:{...N,...T.ownerState}},...U,children:L}),L.pop()]})})):(0,b.jsx)(x.default.Provider,{value:J,children:(0,b.jsxs)(S,{...T,as:V,ref:P,...!(0,q.default)(S)&&{ownerState:{...N,...T.ownerState}},...U,children:[L,B&&(0,b.jsx)(Q,{...R,children:B})]})})});var I=a.i(61537),J=a.i(11440);let K=(0,J.default)((0,b.jsx)("path",{d:"M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4m-9-2V7H4v3H1v2h3v3h2v-3h3v-2zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4"}),"PersonAdd"),L=(0,J.default)((0,b.jsx)("path",{d:"M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"}),"Delete");a.s(["default",0,L],45106);var M=a.i(40347),N=a.i(68581),O=a.i(44633),P=a.i(31316),Q=a.i(89592);let R=a.i(24460).GRAPHQL_ENDPOINT,S=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,T=a=>"complete"===a?"#4caf50":"transparent",U=({status:a})=>(0,b.jsx)(m.default,{sx:{width:12,height:12,borderRadius:"50%",backgroundColor:T(a),border:"complete"!==a?"2px solid #9e9e9e":"none",background:"partial"===a?"linear-gradient(90deg, #4caf50 50%, transparent 50%)":T(a)}});a.s(["ProjectCard",0,({title:a,author:o,genre:p,logline:q,coverImage:r,maxWidth:s,maxHeight:t,enableCardShadow:u=!0,onDelete:v,projectId:w,sharedWith:x=[],to:y,progress:z=[{label:"Title",status:"complete"},{label:"Logline",status:"complete"},{label:"Characters",status:"complete"},{label:"Treatment",status:"partial"},{label:"Outline",status:"partial"},{label:"Screenplay",status:"complete"}]})=>{let A=(0,d.useRouter)(),B=(0,M.useTheme)(),C=(0,O.useQueryClient)(),[D,E]=c.useState(null),[F,G]=c.useState(""),[J,T]=c.useState(""),V=Array.isArray(x)?x:[],W=(0,N.useMutation)({mutationFn:a=>(0,P.request)(R,Q.UPDATE_PROJECT_SHARED_WITH,{projectId:w,sharedWith:a}),onSuccess:()=>{w&&(C.invalidateQueries({queryKey:["project",w]}),C.invalidateQueries({queryKey:["projects"]}))}}),X=()=>{let a=F.trim();if(a){if(!S.test(a.trim()))return void T("Enter a valid email address.");if(V.includes(a))return void T("Already shared with this email.");T(""),G(""),W.mutate([...V,a])}},Y=r?.trim()?r:"https://m.media-amazon.com/images/I/513WUcomv-L._AC_UF1000,1000_QL80_.jpg";return(0,b.jsxs)(e.default,{role:y?"button":void 0,tabIndex:y?0:void 0,onKeyDown:y?a=>{("Enter"===a.key||" "===a.key)&&(a.preventDefault(),A.push(y))}:void 0,onClick:a=>{console.log("to: ",y),y&&(console.log("target: ",a.target.closest),a.preventDefault(),A.push(y))},elevation:+!!u,sx:{display:"flex",maxWidth:s||500,maxHeight:t||250,borderRadius:2,boxShadow:u?"0 2px 8px rgba(0,0,0,0.1)":"none",overflow:"hidden",...y?{cursor:"pointer","&:hover":{boxShadow:3},transition:"box-shadow 0.2s ease"}:{}},children:[(0,b.jsx)(f.default,{component:"img",sx:{p:1,width:150,height:"max-content",objectFit:"cover",borderRadius:4},image:Y,alt:`${a} cover`}),(0,b.jsxs)(m.default,{sx:{display:"flex",flexDirection:"column",flex:1,position:"relative"},children:[(0,b.jsxs)(m.default,{sx:{position:"absolute",top:8,right:8,display:"flex",gap:.5,alignItems:"center"},children:[w?(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(j.default,{variant:"outlined",size:"small",startIcon:(0,b.jsx)(K,{}),onClick:a=>{a.preventDefault(),a.stopPropagation(),E(a.currentTarget)},sx:{minWidth:"auto",py:.25,px:1},"data-no-navigate":!0,children:"Share Project"}),(0,b.jsx)(k.default,{open:!!D,anchorEl:D,onClose:()=>{E(null),T(""),G("")},anchorOrigin:{vertical:"bottom",horizontal:"right"},transformOrigin:{vertical:"top",horizontal:"right"},onClick:a=>a.stopPropagation(),children:(0,b.jsxs)(m.default,{sx:{p:2,minWidth:320,maxWidth:400},onClick:a=>a.stopPropagation(),children:[(0,b.jsx)(h.default,{variant:"subtitle2",color:"text.secondary",gutterBottom:!0,children:"Shared with"}),0===V.length?(0,b.jsx)(h.default,{variant:"body2",color:"text.secondary",children:"Not shared with anyone yet."}):(0,b.jsx)(n.default,{dense:!0,sx:{py:0,maxHeight:200,overflow:"auto"},children:V.map(a=>(0,b.jsx)(H,{secondaryAction:(0,b.jsx)(i.default,{edge:"end",size:"small","aria-label":`Remove ${a}`,onClick:b=>{b.preventDefault(),b.stopPropagation(),W.mutate(V.filter(b=>b!==a))},children:(0,b.jsx)(L,{fontSize:"small"})}),children:(0,b.jsx)(I.default,{primary:a,primaryTypographyProps:{variant:"body2"}})},a))}),(0,b.jsxs)(m.default,{sx:{display:"flex",gap:1,mt:2,alignItems:"flex-start"},children:[(0,b.jsx)(l.default,{size:"small",placeholder:"Add email",value:F,onChange:a=>{G(a.target.value),T("")},onKeyDown:a=>"Enter"===a.key&&(a.preventDefault(),X()),error:!!J,helperText:J,fullWidth:!0}),(0,b.jsx)(j.default,{variant:"contained",size:"small",onClick:a=>{a.preventDefault(),a.stopPropagation(),X()},children:"Add"})]})]})})]}):null,v&&(0,b.jsx)(i.default,{"aria-label":"Delete project",size:"small","data-no-navigate":!0,onClick:a=>{a.preventDefault(),a.stopPropagation(),v()},sx:{backgroundColor:B.palette.error.light,color:B.palette.error.contrastText??B.palette.common.white,"&:hover":{backgroundColor:B.palette.error.main}},children:(0,b.jsx)(L,{fontSize:"small"})})]}),(0,b.jsxs)(g.default,{sx:{flex:"1 0 auto",pt:2,p:1},children:[(0,b.jsx)(h.default,{variant:"h6",component:"div",sx:{fontWeight:"bold"},children:a}),(0,b.jsxs)(h.default,{variant:"body2",color:"text.secondary",children:["by ",o]}),(0,b.jsx)(h.default,{variant:"body2",sx:{mt:1,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"},children:q}),(0,b.jsxs)(h.default,{variant:"body2",sx:{mt:1},children:["Genre: ",p]}),(0,b.jsx)(h.default,{variant:"body2",sx:{mt:1.5,fontWeight:500},children:"Development Progress:"}),(0,b.jsx)(m.default,{sx:{display:"flex",flexWrap:"wrap",gap:1.5,mt:1,alignItems:"center"},children:z.map(a=>(0,b.jsxs)(m.default,{sx:{display:"flex",flexDirection:"column-reverse",alignItems:"center",gap:.5},children:[(0,b.jsx)(h.default,{variant:"caption",sx:{color:"text.secondary"},children:a.label}),(0,b.jsx)(U,{status:a.status})]},a.label))})]})]})]})}],34105),a.s([],36399)},82724,a=>{"use strict";var b=a.i(31316);let c=b.gql`
{
  getProjectData(input: {user: "rory.garcia1@gmail.com"}) {
    _id
    title
    genre
    type
    logline
    user
    poster
    sharedWith
    
    outline {
      format {
        name
      }
    }
  }
}
`,d=b.gql`
query GetProjectData($input: ProjectFilters) {
    getProjectData(input: $input) {
        _id
        title
        genre
        type
        logline
        user
        poster
        sharedWith
        characters {
          details {
            age
            bio
            gender
            need
            version
            want
         }
         imageUrl
        name
        }
        scenes {
            number
            activeVersion
            projectId
            versions {
                act
                antithesis
                step
                synopsis
                synthesis
                thesis
                version
                sceneHeading
                locked
            }
        }
        outline {
        format {
            name
        }
        }
    }
}
`;a.s(["PROJECTS_QUERY",0,c,"PROJECT_QUERY",0,d])}];

//# sourceMappingURL=apps_web_src_f406884a._.js.map