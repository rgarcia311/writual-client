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
    console.log('getData params: ', { params, model })
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
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/e25f859c-d7ba-44eb-86e1-bc11ced01386',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dataHelpers.ts:updateData:pre-updateOne',message:'before updateOne',data:{id,idType:typeof id,idValid:mongoose.Types.ObjectId.isValid(id),projectFilterKeys:Object.keys(projectFilter),dataObjKeys:Object.keys(dataObj),hasNewOption:true},timestamp:Date.now(),hypothesisId:'H1,H2,H3'})}).catch(()=>{});
            // #endregion
            console.log('running updateOne: ', { model })
            model.updateOne(projectFilter, dataObj).then((data: any) => {
                resolve(data)
            }).catch((err: any) => {
                reject(err)
            })
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
