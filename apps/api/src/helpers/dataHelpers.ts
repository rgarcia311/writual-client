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
        
        const projectFilter = mongoose.Types.ObjectId.isValid(id)
            ? { _id: new mongoose.Types.ObjectId(id) }
            : { _id: id }

        if (property === "scenes") {
            model.findOneAndUpdate(projectFilter, dataObj, { new: true }, (err: any, data: any) => {
                if (err) reject(err)
                else resolve(data)
            })
        } else {
            model.updateOne(projectFilter, dataObj, { new: true }, (err: any, data: any) => {
                if (err) reject(err)
                else resolve(data)
            })
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
export const updateSceneVersionInProject = (
    model: any,
    _id: string,
    sceneNumber: number,
    activeVersion: number,
    act: number | undefined,
    versionPayload: any,
    lockedVersion: number | null | undefined
) => {
    return new Promise((resolve, reject) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(_id)) {
          reject(new Error(`Invalid project _id: ${_id}`));
          return;
        }
        const objectId = new mongoose.Types.ObjectId(_id);
        const sn = Number(sceneNumber);
        const av = Number(activeVersion);
        const $set: Record<string, any> = {
          'scenes.$[elem].activeVersion': av,
          'scenes.$[elem].versions.$[ver].sceneHeading': versionPayload?.sceneHeading ?? '',
          'scenes.$[elem].versions.$[ver].thesis': versionPayload?.thesis ?? '',
          'scenes.$[elem].versions.$[ver].antithesis': versionPayload?.antithesis ?? '',
          'scenes.$[elem].versions.$[ver].synthesis': versionPayload?.synthesis ?? '',
          'scenes.$[elem].versions.$[ver].synopsis': versionPayload?.synopsis ?? '',
          'scenes.$[elem].versions.$[ver].step': versionPayload?.step ?? '',
        };
        if (versionPayload?.act !== undefined && versionPayload?.act !== null) {
          $set['scenes.$[elem].versions.$[ver].act'] = versionPayload.act;
        }
        if (lockedVersion !== undefined && lockedVersion !== null) {
          $set['scenes.$[elem].lockedVersion'] = lockedVersion;
        }
        const update: Record<string, any> = { $set };
        if (lockedVersion === undefined || lockedVersion === null) {
          update.$unset = { 'scenes.$[elem].lockedVersion': 1 };
        }
        model.findOneAndUpdate(
            { _id: objectId, 'scenes.number': sn, 'scenes.versions.version': av },
            update,
            {
                arrayFilters: [
                    { 'elem.number': sn },
                    { 'ver.version': av },
                ],
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

