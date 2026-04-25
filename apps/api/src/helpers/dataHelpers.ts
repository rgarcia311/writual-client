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
    return new Promise( async (resolve, reject) => {
        if (Object.keys(params).length && params.input) {
            const query = projectQueryFromInput(params.input)
            try {
                const data = await model.find(query)
                if (data.length > 0) resolve(data)
                else resolve([])
            } catch (e) {
                reject(e)
            }
        }
    })
}

export const updateData = (model: any, input: any, id: string, property: string = "") => {
    //see  if its bc the first scene has no number or version
    return new Promise((resolve, reject) => {
        let inputKeys = Object.keys(input)
        let dataObj = {}
        dataObj[property] = input[inputKeys[0]]
        let projectFilter = {}
        try {
            projectFilter = mongoose.Types.ObjectId.isValid(id)
            ? { _id: new mongoose.Types.ObjectId(id) }
            : { _id: id }

            model.updateOne(projectFilter, dataObj).then((data: any) => {
                resolve(data)
            }).catch((err: any) => {
                reject(err)
            })
        } catch (e) {
            reject(e)
        }
       
        
       
    })
}

export const insertData = async (data: any) => {
    await data.save();
    return data;
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
