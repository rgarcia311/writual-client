"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schema = void 0;
const lodash_1 = require("lodash");
const project_1 = require("../typeDefs/project");
const schema_1 = require("@graphql-tools/schema");
const resolvers = {};
exports.schema = (0, schema_1.makeExecutableSchema)({
    typeDefs: [project_1.ProjectType],
    resolvers: (0, lodash_1.merge)(resolvers, project_1.resolvers),
});
