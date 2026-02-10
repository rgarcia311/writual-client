import mongoose from "mongoose";
import { ProjectType } from "../enums"
import { sceneSchema, characterSchema } from "./"
import  { outlineFrameworkSchema } from "./outline-schema"
import { inspirationSchema } from "./inspiration-schema"
import { treatmentSchema }  from "./treatment-schema"
import { screenplaySchema } from "./screenplay-schema"
import { feedbackSchema } from "./feedback-schema"

export const projectSchema = new mongoose.Schema({
    created_date:  { type: String  },
    modified_date: { type: String },
    revision:  { type: Number },
    user: { type: String },
    displayName: { type: String },
    email: { type: String },
    sharedWith: { type: [String] },
    type: { type: String, enum: ProjectType },
    genre: { type: String },
    title: { type: String },
    logline:{ type:  String },
    budget: { type: Number },
    poster: { type: String },
    timePeriod: {type: String},
    similarProjects: [String],
    outlineName: { type: String },
    scenes: { type: [sceneSchema] },
    characters: { type: [characterSchema] },
    outline: { type: outlineFrameworkSchema }, 
    // Store inspiration as an array of subdocuments so it matches the GraphQL type [inspiration].
    inspiration: { type: [inspirationSchema] },  //Continue extending project schema from here
    treatment: {type: treatmentSchema  }, 
    screenplay: { type: screenplaySchema },
    feedback: { type: feedbackSchema }
   
})