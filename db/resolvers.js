//modelo
const Usuario = require('../models/Usuario');
const Producto = require('../models/Producto');
const Cliente = require('../models/Cliente');
const Pedido = require('../models/Pedido');

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
        },
        obtenerClientes: async () => {
            try {
                const clientes = await Cliente.find({});
                return clientes;
            }catch(error){
                console.log(error);
            }

        },
        obtenerClientesVendedor: async (_,{},ctx) => {
            try {
                const clientes = await Cliente.find({ vendedor: ctx.usuario.id.toString()});
                return clientes;
            }catch(error){
                console.log(error);
            }
        },
        obtenerCliente: async (_, {id},ctx) => {
            //Revisar que el cliente exista
            const cliente = await Cliente.findById(id);

            if(!cliente) throw new Error('Cliente no encontrado');

            //Quien lo creo puede verlo
            if(cliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales para ver el cliente');
            }

            return cliente;

        },
        obtenerPedidos: async () => {
            try {
                const pedidos = await Pedido.find({});
                return pedidos;

            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedidosVendedor: async (_,{}, ctx) => {
            try {
                const pedidos = await Pedido.find({ vendedor: ctx.usuario.id });
                return pedidos;

            } catch (error) {
                console.log(error);
            } 
        },
        obtenerPedido: async (_, {id}, ctx) =>{
            //si el pedido existe o no
            const pedido = await Pedido.findById(id);
            if(!pedido) { throw new Error('Pedido no encontrado'); }

            //Solo quien lo creo puede verlo
            if(pedido.vendedor.toString() !== ctx.usuario.id){
                throw new Error('No tiene las credenciales');
            }
            //retornar el resultado
            return pedido;

        },
        obtenerPedidosEstado: async (_,{estado},ctx) =>{
            const pedidos = await Pedido.find({ vendedor: ctx.usuario.id , estado});

            return pedidos;
        },
        mejoresClientes: async () =>{
            const clientes = await Pedido.aggregate([
                { $match: { estado: "COMPLETADO" } },
                { $group: {
                    _id: "$cliente",
                    total: {$sum: '$total'}
                }},
                {
                    $lookup: {
                        from: 'clientes',
                        localField: '_id',
                        foreignField: "_id",
                        as: "cliente"
                    }
                },
                {
                    $limit: 10
                },
                {
                    $sort: { total: -1 }
                }
            ]);

            return clientes;
        },
        mejoresVendedores: async () => {
            const vendedores = await Pedido.aggregate([
                { $match: { estado: "COMPLETADO" } },
                { $group: {
                    _id: "$vendedor",
                    total: { $sum: '$total' }
                }},
                {
                    $lookup: {
                        from: 'usuarios',
                        localField: '_id',
                        foreignField:'_id',
                        as: 'vendedor'
                    }
                },
                {
                    $limit: 3
                },
                {
                    $sort: { total: -1}
                }
            ]);

            return vendedores;
        },
        buscarProducto: async (_, {texto}) => {
            const productos = await Producto.find({ $text: { $search: texto } }).limit (10);

            return productos;
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
                console.log(error);
            }        
        
        },
        actualizarCliente: async (_, {id, input} , ctx) => {
            //Verficar si existe
            let cliente = await Cliente.findById(id);

            if(!cliente) throw new Error('El cliente no existe');
        
            //Verificar si el vendedor es quien edita
            if(cliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales para ver el cliente');
            }
            // guardar el cliente

            cliente = await Cliente.findOneAndUpdate({ _id: id }, input, { new: true });
            return cliente;


        },
        eliminarCliente: async (_,{ id }, ctx) => {
            //Verficar si existe
            let cliente = await Cliente.findById(id);

            if(!cliente) throw new Error('El cliente no existe');

            //Verificar si el vendedor es quien edita
            if(cliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales');
            }
            // eliminar cliente

            await Cliente.findOneAndDelete({ _id: id });
            return "Cliente Eliminado";
        },
        nuevoPedido: async (_,{input},ctx) => {
            const {cliente} = input;
            //Verificar si cliente existe
            let clienteExiste = await Cliente.findById(cliente);

            if(!clienteExiste) throw new Error('Ese cliente no existe');

            //Verificar si el cliente es del vendedor
            if(clienteExiste.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales');
            }

            //Revisar que el stock este disponible
            for await( const articulo of input.pedido ) {
                    const { id } = articulo;

                    const producto = await Producto.findById(id);
                    console.log(producto);

                    if(articulo.cantidad > producto.existencia){
                        throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponible`);
                    } else {
                        //Restar la cantidad de producto disponible
                        producto.existencia -= articulo.cantidad;

                        await producto.save();
                    }

            }

            //Crear un nuevo pedido
            const nuevoPedido = new Pedido(input);

            //Asignar un vendedor
            nuevoPedido.vendedor = ctx.usuario.id;

            //Guardarlo en la base de datos
            const resultado = await nuevoPedido.save();
            return resultado;

        },
        actualizarPedido: async (_, {id, input} , ctx) => {
            const {cliente} = input;

            //Verificar si el pedido existe
            const existePedido = await Pedido.findById(id); 
            if(!existePedido) throw new Error('El pedido no existe');

            //verficicar el cliente
            const existeCliente = await Cliente.findById(cliente); 
            if(!existeCliente) throw new Error('El cliente no existe');

            //si el cliente y pedido pertenece al vendedor
            if(existeCliente.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tiene las credenciales')
            }

            //revisar el stock
            if(input.pedido){
                for await(const articulo of input.pedido) {
                    const {id} = articulo;
    
                    const producto = await Producto.findById(id);
                    
                    if(articulo.cantidad > producto.existencia) {
                        throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponible`);
    
                    } else {
                        producto.existencia -= articulo.cantidad;
                        await producto.save();
                    }
                }
            }
            
            //guardar el pedido
            const resultado = await Pedido.findOneAndUpdate({_id: id}, input, {new: true});
            return resultado;


        },
        eliminarPedido: async (_,{ id }, ctx) => {
            //verficar si existe
            let pedido = await Pedido.findById(id);
            if(!pedido) throw new Error('El pedido no existe');

            //Verificar si el vendedor es quien lo borra
            if(pedido.vendedor.toString() !== ctx.usuario.id) {
                throw new Error('No tienes las credenciales');
            }

            //Eliminar el pedido de la base de datos
            await Pedido.findByIdAndDelete({_id: id });
            return "Pedido Eliminado";
        } 
        
    },
    
}

module.exports = resolvers;