module.exports=[23304,30340,50584,a=>{"use strict";var b=a.i(2320),c=a.i(39337),d=a.i(99220),e=a.i(63624),f=a.i(61857),g=a.i(70793),h=a.i(21620),i=a.i(5247);function j(a){return(0,i.default)("MuiCard",a)}(0,h.default)("MuiCard",["root"]);var k=a.i(65886);let l=(0,e.styled)(g.default,{name:"MuiCard",slot:"Root"})({overflow:"hidden"}),m=b.forwardRef(function(a,b){let e=(0,f.useDefaultProps)({props:a,name:"MuiCard"}),{className:g,raised:h=!1,...i}=e,m={...e,raised:h},n=(a=>{let{classes:b}=a;return(0,d.default)({root:["root"]},j,b)})(m);return(0,k.jsx)(l,{className:(0,c.default)(n.root,g),elevation:h?8:void 0,ref:b,ownerState:m,...i})});function n(a){return(0,i.default)("MuiCardMedia",a)}a.s(["default",0,m],23304),(0,h.default)("MuiCardMedia",["root","media","img"]);let o=(0,e.styled)("div",{name:"MuiCardMedia",slot:"Root",overridesResolver:(a,b)=>{let{ownerState:c}=a,{isMediaComponent:d,isImageComponent:e}=c;return[b.root,d&&b.media,e&&b.img]}})({display:"block",backgroundSize:"cover",backgroundRepeat:"no-repeat",backgroundPosition:"center",variants:[{props:{isMediaComponent:!0},style:{width:"100%"}},{props:{isImageComponent:!0},style:{objectFit:"cover"}}]}),p=["video","audio","picture","iframe","img"],q=["picture","img"],r=b.forwardRef(function(a,b){let e=(0,f.useDefaultProps)({props:a,name:"MuiCardMedia"}),{children:g,className:h,component:i="div",image:j,src:l,style:m,...r}=e,s=p.includes(i),t=!s&&j?{backgroundImage:`url("${j}")`,...m}:m,u={...e,component:i,isMediaComponent:s,isImageComponent:q.includes(i)},v=(a=>{let{classes:b,isMediaComponent:c,isImageComponent:e}=a;return(0,d.default)({root:["root",c&&"media",e&&"img"]},n,b)})(u);return(0,k.jsx)(o,{className:(0,c.default)(v.root,h),as:i,role:!s&&j?"img":void 0,ref:b,style:t,ownerState:u,src:s?j||l:void 0,...r,children:g})});function s(a){return(0,i.default)("MuiCardContent",a)}a.s(["default",0,r],30340),(0,h.default)("MuiCardContent",["root"]);let t=(0,e.styled)("div",{name:"MuiCardContent",slot:"Root"})({padding:16,"&:last-child":{paddingBottom:24}}),u=b.forwardRef(function(a,b){let e=(0,f.useDefaultProps)({props:a,name:"MuiCardContent"}),{className:g,component:h="div",...i}=e,j={...e,component:h},l=(a=>{let{classes:b}=a;return(0,d.default)({root:["root"]},s,b)})(j);return(0,k.jsx)(t,{as:h,className:(0,c.default)(l.root,g),ownerState:j,ref:b,...i})});a.s(["default",0,u],50584)},30311,a=>{"use strict";var b=a.i(31316);let c=b.gql`
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
`;a.s(["PROJECT_SCENES_QUERY",0,c])},79437,(a,b,c)=>{function d(a,b=100,c={}){let e,f,g,h,i;if("function"!=typeof a)throw TypeError(`Expected the first parameter to be a function, got \`${typeof a}\`.`);if(b<0)throw RangeError("`wait` must not be negative.");let{immediate:j}="boolean"==typeof c?{immediate:c}:c;function k(){let b=e,c=f;return e=void 0,f=void 0,i=a.apply(b,c)}function l(){let a=Date.now()-h;a<b&&a>=0?g=setTimeout(l,b-a):(g=void 0,j||(i=k()))}let m=function(...a){if(e&&this!==e&&Object.getPrototypeOf(this)===Object.getPrototypeOf(e))throw Error("Debounced method called with different contexts of the same prototype.");e=this,f=a,h=Date.now();let c=j&&!g;return g||(g=setTimeout(l,b)),c&&(i=k()),i};return Object.defineProperty(m,"isPending",{get:()=>void 0!==g}),m.clear=()=>{g&&(clearTimeout(g),g=void 0)},m.flush=()=>{g&&m.trigger()},m.trigger=()=>{i=k(),m.clear()},m}b.exports.debounce=d,b.exports=d},38912,23145,33425,11883,a=>{"use strict";a.i(73613);var b=a.i(79437),c=a.i(2320);a.s(["useDebounce",0,a=>{let d=(0,c.useRef)(null);return(0,c.useEffect)(()=>{d.current=a},[a]),(0,c.useMemo)((...a)=>(0,b.default)((...a)=>{d.current?.(...a)},1e3),[])}],23145);var d=a.i(68581),e=a.i(44633),f=a.i(31316);let g=f.gql`
  mutation CreateScene(
    $versions: [SceneContentInput]
    $_id: String
  ) {
    createScene(
      input: {
        _id: $_id
        versions: $versions
      }
    ) {
      number
    }
  }
`,h=f.gql`
  mutation UpdateScene(
    $_id: String!
    $number: Int
    $activeVersion: Int
    $lockedVersion: Int
    $newVersion: Boolean
    $newScene: Boolean
    $versions: [SceneContentInput]
  ) {
    createScene(
      input: {
        _id: $_id
        number: $number
        activeVersion: $activeVersion
        lockedVersion: $lockedVersion
        newVersion: $newVersion
        newScene: $newScene
        versions: $versions
      }
    ) {
      number
    }
  }
`;a.s(["CREATE_SCENE",0,g,"UPDATE_SCENE",0,h],33425);let i=f.gql`
  mutation DeleteScene($projectId: String!, $sceneNumber: Int!) {
    deleteScene(projectId: $projectId, sceneNumber: $sceneNumber) {
      id
      scenes {
        number
      }
    }
  }
`;var j=a.i(24460);let k="project-scenes";function l(){let a=(0,e.useQueryClient)(),b=(0,d.useMutation)({mutationFn:async a=>(0,f.request)(j.GRAPHQL_ENDPOINT,h,{_id:a._id,number:a.number,activeVersion:a.activeVersion,lockedVersion:a.lockedVersion??void 0,newVersion:a.newVersion,newScene:!1,versions:a.versions}),onSuccess:(b,c)=>{c._id&&a.invalidateQueries({queryKey:[k,c._id]})}});return{updateSceneMutation:b,deleteSceneMutation:(0,d.useMutation)({mutationFn:async a=>(0,f.request)(j.GRAPHQL_ENDPOINT,i,{projectId:a._id,sceneNumber:a.number}),onSuccess:(b,c)=>{c._id&&a.invalidateQueries({queryKey:[k,c._id]})}}),createSceneMutation:(0,d.useMutation)({mutationFn:async a=>(0,f.request)(j.GRAPHQL_ENDPOINT,g,{_id:a._id,versions:a.versions,number:a.number}),onSuccess:(b,c)=>{c._id&&a.invalidateQueries({queryKey:[k,c._id]})}})}}a.s(["PROJECT_SCENES_QUERY_KEY",0,k,"useProjectSceneMutations",()=>l],11883),a.s([],38912)}];

//# sourceMappingURL=_47cf2db0._.js.map