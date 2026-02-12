import mongoose from "mongoose"

/** Build find query from input; project lookup uses MongoDB _id (supports input.id or input._id). */
function projectQueryFromInput(input: any): any {
    if (!input || typeof input !== 'object') return input
    const query = { ...input }
    if (query.id != null) {
        query._id = mongoose.Types.ObjectId.isValid(query.id) ? new mongoose.Types.ObjectId(query.id) : query.id
        delete query.id
    } else if (query._id != null && typeof query._id === 'string') {
        query._id = mongoose.Types.ObjectId.isValid(query._id) ? new mongoose.Types.ObjectId(query._id) : query._id
    }
    return query
}

export const getData = (model: any, params: any = {}) => {
    console.log({ params })
    return new Promise( async (resolve, reject) => {
        if (Object.keys(params).length && params.input) {
            const query = projectQueryFromInput(params.input)
            console.log({ query })
            
            try {
                const data = await model.find(query)
                console.log({ data })
                if (data.length > 0) resolve(data)
                else resolve([])
            } catch (e) {
                reject(e)
            }
        }
    })
}

export const getScenes = (model: any, params: any = {}) => {
    return new Promise( async (resolve, reject) => {
        if (Object.keys(params).length && params.input) {
            const query = projectQueryFromInput(params.input)
            try {
               const data = await model.find(query)
               if (data.length > 0) resolve(data[0].scenes)
               else resolve([])
            } catch (e) {
                reject(e)
            }
        }
    })
}

export const updateData = (model: any, input: any, id: string, property: string = "") => {
    console.log('running updateData with input: ', input, 'id: ', id, 'property: ', property)
    //see  if its bc the first scene has no number or version 
    return new Promise((resolve, reject) => {
       // console.log('propertyAndData: ', JSON.stringify(propertyAndData, null, "\t"))
        let inputKeys = Object.keys(input)
        let dataObj = {}
        dataObj[property] = input[inputKeys[0]]
        let projectFilter = {}
        try {
            projectFilter = mongoose.Types.ObjectId.isValid(id)
            ? { _id: new mongoose.Types.ObjectId(id) }
            : { _id: id }

            console.log('projectFilter: ', projectFilter)
            console.log('dataObj: ', dataObj)

            if (property === "scenes") {
                model.findOneAndUpdate(projectFilter, dataObj).then((data: any) => {
                    resolve(data)
                }).catch((err: any) => {
                    reject(err)
                })
            } else {
                // #region agent log
                fetch('http://127.0.0.1:7243/ingest/e25f859c-d7ba-44eb-86e1-bc11ced01386',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dataHelpers.ts:updateData:pre-updateOne',message:'before updateOne',data:{id,idType:typeof id,idValid:mongoose.Types.ObjectId.isValid(id),projectFilterKeys:Object.keys(projectFilter),dataObjKeys:Object.keys(dataObj),hasNewOption:true},timestamp:Date.now(),hypothesisId:'H1,H2,H3'})}).catch(()=>{});
                // #endregion
                console.log('running updateOne: ', { model })
                model.updateOne(projectFilter, dataObj).then((data: any) => {
                    resolve(data)
                }).catch((err: any) => {
                    reject(err)
                })
            }
        } catch (e) {
            console.log('error in updateData: ', e)
            reject(e)
        }
       
        
       
    })
}

export const insertData = (data: any) => {
    return new Promise((resolve, reject) => {
        try {
            data.save()
            resolve(data)
        } catch (e) {
            reject(e)
        }
      
    })
}

export const deleteData = (model: any, id: any) => {
    return new Promise(async (resolve, reject) => {
        try {
            const filter = mongoose.Types.ObjectId.isValid(id) ? { _id: new mongoose.Types.ObjectId(id) } : { _id: id }
            await model.deleteOne(filter)
            resolve(`deleted _id: ${id}`)
        } catch (err) {
            console.log(`error deleting ${id}: `, err)
            reject(err)
        }
    })
}

/**
 * Update only the active version of an existing scene (in-place). Also sets scene.activeVersion and scene.lockedVersion.
 */
export const updateSceneVersionInProject = async (
    model: any,
    _id: string,
    sceneNumber: number,
    activeVersion: number,
    _act: number | undefined,
    versionPayload: any,
    lockedVersion: number | null | undefined
) => {
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      throw new Error(`Invalid project _id: ${_id}`);
    }
    const objectId = new mongoose.Types.ObjectId(_id);
    const sn = Number(sceneNumber);
    const av = Number(activeVersion);

    const project = await model.findOne({ _id: objectId }).exec();
    if (!project || !project.scenes) {
      return null;
    }

    const sceneIndex = project.scenes.findIndex((s: any) => Number(s.number) === sn);
    if (sceneIndex < 0) {
      return null;
    }

    const scene = project.scenes[sceneIndex];
    const versions = Array.isArray(scene.versions) ? scene.versions : [];
    const versionIndex = versions.findIndex((v: any) => Number(v.version) === av);
    if (versionIndex < 0) {
      return null;
    }

    const updatedVersion = {
      ...versions[versionIndex],
      sceneHeading: versionPayload?.sceneHeading ?? '',
      thesis: versionPayload?.thesis ?? '',
      antithesis: versionPayload?.antithesis ?? '',
      synthesis: versionPayload?.synthesis ?? '',
      synopsis: versionPayload?.synopsis ?? '',
      step: versionPayload?.step ?? '',
      act: versionPayload?.act !== undefined && versionPayload?.act !== null ? versionPayload.act : versions[versionIndex]?.act,
      version: av,
    };
    project.scenes[sceneIndex].versions[versionIndex] = updatedVersion;
    project.scenes[sceneIndex].activeVersion = av;
    if (lockedVersion !== undefined && lockedVersion !== null) {
      project.scenes[sceneIndex].lockedVersion = lockedVersion;
    } else {
      project.scenes[sceneIndex].lockedVersion = undefined;
    }
    return model.findByIdAndUpdate(objectId, { $set: { scenes: project.scenes } }, { new: true }).exec();
};

/**
 * Add a new version to an existing scene and set it as active.
 */
export const updateSceneAddVersionInProject = (
    model: any,
    _id: string,
    sceneNumber: number,
    newVersionPayload: any,
    activeVersion: number
) => {
    return new Promise((resolve, reject) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(_id)) {
          reject(new Error(`Invalid project _id: ${_id}`));
          return;
        }
        const objectId = new mongoose.Types.ObjectId(_id);
        const sn = Number(sceneNumber);
        model.findOneAndUpdate(
            { _id: objectId, 'scenes.number': sn },
            {
              $push: { 'scenes.$[elem].versions': newVersionPayload },
              $set: { 'scenes.$[elem].activeVersion': activeVersion },
            },
            {
                arrayFilters: [{ 'elem.number': sn }],
                new: true,
            },
            (err: any, data: any) => {
                if (err) reject(err);
                else resolve(data);
            }
        );
      } catch (err) {
        reject(err);
      }
    });
};

