export const PORT = process.env.PORT || 8080;
export const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
export const environment = {
    development: {
        serverURL: `http://localhost:${PORT}/`,
        dbString: 'mongodb://localhost:27017/writual'
    }, 
    
}