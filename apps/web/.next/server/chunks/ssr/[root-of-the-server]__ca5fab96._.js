module.exports=[80539,(a,b,c)=>{"use strict";b.exports=a.r(53605).vendored.contexts.HooksClientContext},57122,(a,b,c)=>{"use strict";b.exports=a.r(53605).vendored.contexts.ServerInsertedHtml},56704,(a,b,c)=>{b.exports=a.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(a,b,c)=>{b.exports=a.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},20635,(a,b,c)=>{b.exports=a.x("next/dist/server/app-render/action-async-storage.external.js",()=>require("next/dist/server/app-render/action-async-storage.external.js"))},85688,(a,b,c)=>{"use strict";b.exports=a.r(53605).vendored.contexts.AppRouterContext},20378,(a,b,c)=>{"use strict";b.exports=a.r(53605).vendored["react-ssr"].ReactServerDOMTurbopackClient},79374,a=>{"use strict";var b=a.i(11440),c=a.i(65886);let d=(0,b.default)((0,c.jsx)("path",{d:"M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"}),"Add");a.s(["default",0,d])},26805,a=>{"use strict";var b=a.i(13032);a.s(["IconButton",()=>b.default])},96309,a=>{"use strict";var b=a.i(2320),c=a.i(99220),d=a.i(26448),e=a.i(36113),f=a.i(63624),g=a.i(92443),h=a.i(28249),i=a.i(5199),j=a.i(21620),k=a.i(5247);function l(a){return(0,k.default)("PrivateSwitchBase",a)}(0,j.default)("PrivateSwitchBase",["root","checked","disabled","input","edgeStart","edgeEnd"]);var m=a.i(77170),n=a.i(65886);let o=(0,f.styled)(i.default,{name:"MuiSwitchBase"})({padding:9,borderRadius:"50%",variants:[{props:{edge:"start",size:"small"},style:{marginLeft:-3}},{props:({edge:a,ownerState:b})=>"start"===a&&"small"!==b.size,style:{marginLeft:-12}},{props:{edge:"end",size:"small"},style:{marginRight:-3}},{props:({edge:a,ownerState:b})=>"end"===a&&"small"!==b.size,style:{marginRight:-12}}]}),p=(0,f.styled)("input",{name:"MuiSwitchBase",shouldForwardProp:e.default})({cursor:"inherit",position:"absolute",opacity:0,width:"100%",height:"100%",top:0,left:0,margin:0,padding:0,zIndex:1}),q=b.forwardRef(function(a,b){let{autoFocus:e,checked:f,checkedIcon:i,defaultChecked:j,disabled:k,disableFocusRipple:q=!1,edge:r=!1,icon:s,id:t,inputProps:u,inputRef:v,name:w,onBlur:x,onChange:y,onFocus:z,readOnly:A,required:B=!1,tabIndex:C,type:D,value:E,slots:F={},slotProps:G={},...H}=a,[I,J]=(0,g.default)({controlled:f,default:!!j,name:"SwitchBase",state:"checked"}),K=(0,h.default)(),L=k;K&&void 0===L&&(L=K.disabled);let M="checkbox"===D||"radio"===D,N={...a,checked:I,disabled:L,disableFocusRipple:q,edge:r},O=(a=>{let{classes:b,checked:e,disabled:f,edge:g}=a,h={root:["root",e&&"checked",f&&"disabled",g&&`edge${(0,d.default)(g)}`],input:["input"]};return(0,c.default)(h,l,b)})(N),P={slots:F,slotProps:{input:u,...G}},[Q,R]=(0,m.default)("root",{ref:b,elementType:o,className:O.root,shouldForwardComponentProp:!0,externalForwardedProps:{...P,component:"span",...H},getSlotProps:a=>({...a,onFocus:b=>{a.onFocus?.(b),z&&z(b),K&&K.onFocus&&K.onFocus(b)},onBlur:b=>{a.onBlur?.(b),x&&x(b),K&&K.onBlur&&K.onBlur(b)}}),ownerState:N,additionalProps:{centerRipple:!0,focusRipple:!q,disabled:L,role:void 0,tabIndex:null}}),[S,T]=(0,m.default)("input",{ref:v,elementType:p,className:O.input,externalForwardedProps:P,getSlotProps:a=>({...a,onChange:b=>{a.onChange?.(b),(a=>{if(a.nativeEvent.defaultPrevented||A)return;let b=a.target.checked;J(b),y&&y(a,b)})(b)}}),ownerState:N,additionalProps:{autoFocus:e,checked:f,defaultChecked:j,disabled:L,id:M?t:void 0,name:w,readOnly:A,required:B,tabIndex:C,type:D,..."checkbox"===D&&void 0===E?{}:{value:E}}});return(0,n.jsxs)(Q,{...R,children:[(0,n.jsx)(S,{...T}),I?i:s]})});a.s(["default",0,q],96309)},38696,a=>{"use strict";var b=a.i(31316);let c=b.gql`
query GetProjectCharacters($input: ProjectFilters) {
  getProjectData(input: $input) {
    _id
    characters {
      name
      imageUrl
      details {
        version
        gender
        age
        bio
        need
        want
      }
    }
  }
}
`;a.s(["PROJECT_CHARACTERS_QUERY",0,c])},30311,a=>{"use strict";var b=a.i(31316);let c=b.gql`
  query GetProjectScenes($input: ProjectFilters) {
    getProjectData(input: $input) {
      _id
      scenes {
        number
        activeVersion
        lockedVersion
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
        }
      }
    }
  }
`;a.s(["PROJECT_SCENES_QUERY",0,c])},81361,a=>{"use strict";var b=a.i(2320),c=a.i(49407),d=a.i(90830);function e(a){return a}function f(a,b,f){if("object"!=typeof b||null===b)return;let g=a.getMutationCache(),h=a.getQueryCache(),i=f?.defaultOptions?.deserializeData??a.getDefaultOptions().hydrate?.deserializeData??e,j=b.mutations||[],k=b.queries||[];j.forEach(({state:b,...c})=>{g.build(a,{...a.getDefaultOptions().hydrate?.mutations,...f?.defaultOptions?.mutations,...c},b)}),k.forEach(({queryKey:b,state:e,queryHash:g,meta:j,promise:k,dehydratedAt:l})=>{let m=k?(0,c.tryResolveSync)(k):void 0,n=void 0===e.data?m?.data:e.data,o=void 0===n?n:i(n),p=h.get(g),q=p?.state.status==="pending",r=p?.state.fetchStatus==="fetching";if(p){let a=m&&void 0!==l&&l>p.state.dataUpdatedAt;if(e.dataUpdatedAt>p.state.dataUpdatedAt||a){let{fetchStatus:a,...b}=e;p.setState({...b,data:o})}}else p=h.build(a,{...a.getDefaultOptions().hydrate?.queries,...f?.defaultOptions?.queries,queryKey:b,queryHash:g,meta:j},{...e,data:o,fetchStatus:"idle",status:void 0!==o?"success":e.status});k&&!q&&!r&&(void 0===l||l>p.state.dataUpdatedAt)&&p.fetch(void 0,{initialPromise:Promise.resolve(k).then(i)}).catch(d.noop)})}var g=a.i(44633),h=({children:a,options:c={},state:d,queryClient:e})=>{let h=(0,g.useQueryClient)(e),i=b.useRef(c);b.useEffect(()=>{i.current=c});let j=b.useMemo(()=>{if(d){if("object"!=typeof d)return;let a=h.getQueryCache(),b=d.queries||[],c=[],e=[];for(let d of b){let b=a.get(d.queryHash);b?(d.state.dataUpdatedAt>b.state.dataUpdatedAt||d.promise&&"pending"!==b.state.status&&"fetching"!==b.state.fetchStatus&&void 0!==d.dehydratedAt&&d.dehydratedAt>b.state.dataUpdatedAt)&&e.push(d):c.push(d)}if(c.length>0&&f(h,{queries:c},i.current),e.length>0)return e}},[h,d]);return b.useEffect(()=>{j&&f(h,{queries:j},i.current)},[h,j]),a};a.s(["HydrationBoundary",()=>h],81361)},48836,a=>{"use strict";var b=a.i(65886),c=a.i(35969),d=a.i(45843),e=a.i(93578);let f=(0,a.i(21620).default)("MuiBox",["root"]),g=(0,e.default)({defaultClassName:f.root,generateClassName:d.default.generate});a.i(36399);var h=a.i(34105),i=a.i(79374),j=a.i(39582),k=a.i(68581),l=a.i(52180),m=a.i(44633),n=a.i(31316),o=a.i(82724);a.i(30311),a.i(38696),a.i(42392);var p=a.i(89592);let q=a.i(24460).GRAPHQL_ENDPOINT;a.s(["Projects",0,()=>{let a=(0,m.useQueryClient)(),d=(0,j.useCreateProjectModalStore)(a=>a.openModal),{data:e}=(0,l.useQuery)({queryKey:["projects"],queryFn:async()=>(0,n.request)(q,o.PROJECTS_QUERY)}),f=(0,k.useMutation)({mutationFn:a=>(0,n.request)(q,p.DELETE_PROJECT,{deleteProjectId:a}),onSuccess:()=>{a.invalidateQueries({queryKey:["projects"]})}});return(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(g,{sx:{display:"flex",justifyContent:"center",paddingTop:2,paddingBottom:2},children:(0,b.jsx)(c.Button,{variant:"contained",color:"primary",startIcon:(0,b.jsx)(i.default,{}),onClick:d,children:"Create Project"})}),(0,b.jsx)(g,{sx:{height:"100%",paddingTop:5,overflowY:"scroll",display:"flex",justifyContent:"space-evenly",flexWrap:"wrap",gap:2},children:e?.getProjectData?.map((a,c)=>(0,b.jsx)(g,{sx:{marginTop:"20px",flexShrink:0},children:(0,b.jsx)(h.ProjectCard,{title:a.title,author:a.user,genre:a.genre,logline:a.logline,coverImage:a.coverImage??a.poster,onDelete:a._id?()=>f.mutate(a._id):void 0,projectId:a._id,sharedWith:a.sharedWith??[],to:a._id?`/project/${a._id}`:void 0})},a._id??c))})]})}],48836)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__ca5fab96._.js.map