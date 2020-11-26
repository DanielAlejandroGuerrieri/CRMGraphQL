//modelo
const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Cliente = require('../models/Cliente');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PromiseProvider } = require('mongoose');
require('dotenv').config({path: 'variables.env'});


const crearToken = (usuario, secreta, expiresIn) => {
    console.log(usuario);
    const { id, email, nombre, apellido } = usuario ;

    //                payload      
    return jwt.sign( { id, email, nombre, apellido }, secreta, { expiresIn } ); // firmar un nuevo jwt
}

// Resolvers
const resolvers = {
    Query: {
        obtenerUsuario: async (_,{ token }) => {
            const usuarioId = await jwt.verify( token, process.env.SECRETA ); //verifica el token coincide con algun usuario
            return usuarioId;
        },
        obtenerProductos: async () =>{
            try {
                const productos = await Producto.find({});
                return productos;
            } catch(error){
                console.log(error);
            }
        },
        obtenerProducto: async (_,{ id }) => {
            // revisar si el producto existe o no
            const producto = await Producto.findById(id);

            if(!producto) throw new Error('Producto no encontrado');

            return producto;
        }
    },
    
    Mutation: {
        nuevoUsuario: async (_,{ input }) => {
            const {email,password } = input;

            //Revision de usuario que este registrado
            const existeUsuario = await Usuario.findOne({email});
            if(existeUsuario) throw new Error('El user ya existe registrado');

            //hashear su password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);

            //guardar en bd
            try{
                const usuario = new Usuario(input);
                usuario.save(); //guardarlo
                return usuario;
            } catch (error) {
                console.log(error);
            }


        },
        autenticarUsuario: async (_,{ input }) => {
            const {email, password} = input;
            //Si el user existe
            const existeUsuario = await Usuario.findOne({email});
            console.log(existeUsuario);

            if(!existeUsuario) throw new Error('El usuario no existe');
            

            //revisar si el password es correcto
            const passwordCorrecto = await bcryptjs.compare(password, existeUsuario.password);
            if(!passwordCorrecto){
                throw new Error('El password es Incorrecto');
            }

            //Crear el token
            return {
                token: crearToken(existeUsuario, process.env.SECRETA, '24h')
            }

        },
        nuevoProducto: async (_,{input}) => {
            try {
                const producto = new Producto(input);

                //almacenar en la bd
                const resultado = await producto.save();
                return resultado;

            } catch (error){
                console.log(error);

            }
        },
        actualizarProducto: async ( _, { id,input }) => {
            // revisar si el producto existe o no
            let producto = await Producto.findById(id);

            if(!producto) throw new Error('Producto no encontrado');

            // guardarlo en la base de datos
            producto = await Producto.findOneAndUpdate({_id: id}, input, { new: true });
            return producto;
        },
        eliminarProducto: async (_, { id }) =>{
            // revisar si el producto existe o no
            let producto = await Producto.findById(id);

            if(!producto) throw new Error('Producto no encontrado');

            // Eliminar de la base de datos
            await Producto.findOneAndDelete({_id: id});

            return "Producto eliminado";
        },
        nuevoCliente: async (_, {input} , ctx) => {
            console.log(ctx);
            
            const { email } = input;
            
            //verificar que el cliente este registrado
            const cliente = await Cliente.findOne({ email });
            if(cliente) throw new Error('El cliente ya existe');

            const nuevoCliente = new Cliente(input);

            //asignar vendedor
            nuevoCliente.vendedor = ctx.usuario.id;

            //guardarlo en la BBDD
            try {
                const resultado = await nuevoCliente.save();
                return resultado;
            } catch (error){

            }
            
            

        }
    },
    
}

module.exports = resolvers;