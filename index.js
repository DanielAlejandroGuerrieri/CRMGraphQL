const { ApolloServer } = require('apollo-server');
const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers');
const jwt = require('jsonwebtoken');
require('dotenv').config({path: 'variables.env'});

const conectarDB = require('./config/db');

//Conectar a la base de datos
conectarDB();


//server
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({req})=>{
        //console.log(req.headers['authorization']);

        const token = req.headers['authorization'] || '';
        if(token) {
            try {
                const usuario = jwt.verify( token, process.env.SECRETA ); //verifica el token coincide con algun usuario
               
                return {
                    usuario
                }

            }catch(error) {
                console.log('Hubo un error');
                console.log(error);
            }
        }
    }   
    
});


//start server
server.listen().then( ({url}) => {
    console.log(`Server ready at the URL ${url}`);
});