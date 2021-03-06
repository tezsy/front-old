import React, { useState, useEffect } from 'react';
import { getBraintreeClientToken, processPayment, createOrder} from './apiCore';
import { emptyCart } from './cartHelpers';
import { isAuthenticated } from '../auth';
import { Link } from 'react-router-dom';
import DropIn from 'braintree-web-drop-in-react';
import $ from 'jquery';
import { API } from '../config';


const Checkout = ({ products, setRun = f => f, run = undefined }) => {
  
    
    const [data, setData] = useState({
        loading: false,
        success: false,
        clientToken: null,
        error: '',
        instance: {},
        receiver:'',
        address1: '',
        address2: '',
        city:'',
        poscode:'',
        shipping:0,
        state:'',
        receiptName: '',
        receiptData:'',
        paymentMethod:'',
        paid: false,
        cart: false

    });
    const [button, setButton] = useState({
        receiver: false,
        address1: false,
        city: false,
        poscode: false,
        receiptName: false,
        receiptData: false
    });
    const [test , setTest] = useState('satu')
    const userId = isAuthenticated() && isAuthenticated().user._id;
    const email = isAuthenticated() && isAuthenticated().user.email;
    const token = isAuthenticated() && isAuthenticated().token;

  

    const getToken = (userId, token) => {
        getBraintreeClientToken(userId, token).then(data => {
            if (data.error) {
                setData({ ...data, error: data.error });
            } else {
                setData({ clientToken: data.clientToken });
            }
        });
    };


    useEffect(() => {
        getToken(userId, token);
    }, []);

    const handleAddress = number => event => {
        setData({ ...data, [number]: event.target.value });
        setButton({ ...button, [number]: true });
        console.log(number);
        
    };
;

    const handleReceipt = event => {
        setData({ ...data, receiptName: event.target.value });
        setButton({...button, receiptName: true})
    };


    const handlePhoto = async e => {
        const files = e.target.files;
        const data2 = new FormData()
        data2.append('file', files[0])
        data2.append('upload_preset', 'jombeli-receipt')
        const res = await fetch(
            'https://api.cloudinary.com/v1_1/drzyjnnsq/image/upload', {
                method: 'POST',
                body: data2
            }
        )

        const file = await res.json()
        setData({ ...data, receiptData: file.secure_url  }); 
        setButton({...button, receiptData: true})
    }

    
    const testHandler1 = () => {
        setTest(false)
    }

    const testHandler2 = () => {
        setTest(true)
    }
    const getTotal = () => {
        return products.reduce((currentValue, nextValue) => {
            return currentValue + nextValue.count * nextValue.price;
        }, 0);
    };

    //TODO change to promotion code since postage value did chnage
    const getShipping = (state) => {
        if (state==="Kelantan") {
            return 20;
        }else if (state === "Kedah") {
            return 10;
        }
        return 0;
    }

    const showCheckout = () => {
        console.log(products);
        return isAuthenticated() ? (
            <div> 
                {showAdressForm()}
                {paymentMethodHandler(data.paid)}
                <div>{showDropIn() || showDropOut()}</div>
                
           
            </div>
           
         
        ) : (
            <Link to="/signin">
                <button className="btn btn-primary">Sign in to checkout</button>
            </Link>
        );
    };

    const paymentMethodHandler = (paid) => {
        return(
            <div>
        {data.clientToken !== null && products.length > 0 ? (
        <div style={{ display: paid ? 'none' : '' }}>
            <button onClick={testHandler1} className="btn btn-primary btn-block">
                Pay With Cash Deposit / ATM 
            </button>
            <button onClick={testHandler2} className="btn btn-primary btn-block">
                Pay With Credit Card / Paypal
            </button>
        </div>
        ) : null}</div>
        )
    };


    let deliveryAddress = {
        name:data.receiver,
        line1:data.address1,
        line2:data.address2,
        city: data.city,
        poscode: data.poscode,
        state: data.state
    };
    
    
    let receiptNameData = data.receiptName;
    let receiptDataData = data.receiptData;

    
    const buy = () => {
        setData({ loading: true });

        $('.btn-afterblur').prop('disabled', true);
        const enableBlur =  () => {
            $('.btn-afterblur').prop('disabled', false);
        }
        setTimeout(enableBlur, 5000);

        let nonce;
        let getNonce = data.instance
            .requestPaymentMethod()
            .then(data1 => {
                nonce = data1.nonce;
                let amount = getTotal(products) + getShipping(data.state);
                const paymentData = {
                    paymentMethodNonce: nonce,
                    amount: amount
                };

                processPayment(userId, token, paymentData)
                    .then(response => {
                        console.log(response);
                        // empty cart
                        // create order
                        
                        
                            fetch(`${API}/email/confirm`, {
                                method: 'POST',
                                headers: {
                                    Accept: 'application/json',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({products,email})
                            })
                                
                      
                        const createOrderData = {
                            products: products,
                            transaction_id: response.transaction.id,
                            amount: response.transaction.amount,
                            address: deliveryAddress,
                            receiptName: receiptNameData,
                            receiptData:receiptDataData,
                            
                        };

                        createOrder(userId, token, createOrderData)
                            .then(response => {
                                emptyCart(() => {
                                    setRun(!run); // run useEffect in parent Cart
                                    console.log('payment success and empty cart');
                                    setData({
                                        loading: false,
                                        success: true,
                                        paid: true
                                    });
                                    
                                });
                            })
                            .catch(error => {
                                console.log(error);
                                setData({ loading: false ,paid: true});
                            });
                    })
                    .catch(error => {
                        console.log(error);
                        setData({ loading: false ,paid: true});
                    });
            })
            .catch(error => {
                // console.log("dropin error: ", error);
                setData({ ...data, error: error.message });
                
                
            });
    };

    const buy2 = () => {

        setData({ loading: true });

        $('.btn-afterblur').prop('disabled', true);
        const enableBlur =  () => {
            $('.btn-afterblur').prop('disabled', false);
        }
        setTimeout(enableBlur, 5000);

        if (button.receiptName && button.receiptData) {
            const createOrderData = {
                products: products,
                transaction_id:  'CDM/ATM',
                amount: getTotal(products) + getShipping(data.state),
                address: deliveryAddress,
                receiptName: receiptNameData,
                receiptData:receiptDataData,
             
            };
    
    
        createOrder(userId, token, createOrderData)
            .then(() => {
                emptyCart(() => {
                    setRun(!run); // run useEffect in parent Cart
                    console.log('payment success and empty cart');
                    console.log(createOrderData.address);
                    
                    setData({
                        loading: false,
                        success: true,
                        paid: true
                    });
                    
                });
            })
            .catch(error => {
                console.log(error);
                setData({ loading: false ,paid: true});
                
            });
        }else setData( {...data, error : "choose the bank name and upload the receipt"})
    }

    const showAdressForm = (paid) => {
        
        return(
            <div  style={{ display: paid ? 'none' : '' }}>
            {data.clientToken !== null && products.length > 0 ? (
                <div className="form-group mb-3 border border-primary p-3 rounded">
            <label className="text-muted">Delivery address:</label>
                                <input
                                    onChange={handleAddress('receiver')}
                                    className="form-control mt-2"
                                    value={data.name}
                                    placeholder=
                                    {`name`}
                                />
     
                                <input
                                    onChange={handleAddress('address1')}
                                    className="form-control mt-2"
                                    value={data.address1}
                                    placeholder=
                                    {`address1`}
                                />
                                 <input
                                    onChange={handleAddress('address2')}
                                    className="form-control mt-2"
                                    value={data.address2}
                                    placeholder=
                                    {`address2`}
                                />
                                 <input
                                    onChange={handleAddress('city')}
                                    className="form-control mt-2"
                                    value={data.city}
                                    placeholder=
                                    {`city`}
                                />
                                <input
                                    onChange={handleAddress('poscode')}
                                    className="form-control mt-2"
                                    value={data.poscode}
                                    type="number"
                                    placeholder=
                                    {`poscode`}
                                />
                                <select className="form-control mb-5 mt-2" onChange={handleAddress('state')}>
                                    <option>state</option>
                                    <option value="Terengganu">Terengganu</option>
                                    <option value="Sarawak">Sarawak</option>
                                    <option value="Sabah">Sabah</option>
                                    <option value="Penang">Penang</option>
                                    <option value="Perlis">Perlis</option>
                                    <option value="Pahang">Pahang</option>
                                    <option value="Negeri Sembilan">Negeri Sembilan</option>
                                    <option value="Malacca">Malacca</option>
                                    <option value="Selangor">Selangor</option>
                                    <option value="Perak">Perak</option>
                                    <option value="Kelantan">Kelantan</option>
                                    <option value="Kedah">Kedah</option>
                                    <option value="Johor">Johor</option>
                                    <option value="Kuala Lumpur">Kuala Lumpur</option>
                                    <option value="Putrajaya">Putrajaya</option>
                                    <option value="Labuan">Labuan</option>
                                    
                                
                                </select> </div> ) : null} </div>
        )
    }

    const showDropOut = () => {   
        
        if (!test) {
            return( !data.paid && (                        
                <div className="mt-5">
                    <div className=" border border-primary p-3 rounded">
                    
                   
                           
                        <h5>ATM/Cash Deposit</h5>
                        <p className="mt-4">enter the bank name</p>
                        <select className="form-control mb-5" onChange={handleReceipt} required>
                            <option>choose bank name</option>
                            <option value="Maybank">Maybank</option>
                            <option value="bank islam" >Bank Islam</option>
                            <option value="CIMB bank">CIMB bank</option>
                        
                        </select>
                        <p>enter receipt image</p>
                        <form>
                            <div className="form-group">
                                    <label className="btn btn-secondary">
                                        <input type="file" onChange={handlePhoto} accept="image/*" required/>
                                    </label>
                                <img src={data.receiptData} className="img-thumbnail rounded" alt=""/>
                            </div>
                        
                    
                    {buttonHandler(buy2)}
                </form>
                </div>
                </div> 
            ))
        } 
    }

    const showDropIn = () => {
        if (test) {
            return(
            
                <div className="mt-5" onBlur={() => setData({ ...data, error: '' })}>
                    {data.clientToken !== null && products.length > 0 ? (
                        <div className=" border border-primary p-3 rounded">
                           
        
                            <DropIn
                                options={{
                                    authorization: data.clientToken,
                                    paypal: {
                                        flow: 'vault'
                                    }
                                }}
                                onInstance={instance => (data.instance = instance)}
                            />
                            {buttonHandler(buy)}
                            
                        </div>
                    ) : null}
                </div>
                )
        }
        
    };

    const showError = error => (
        <div className="alert alert-danger" style={{ display: error ? '' : 'none' }}>
            {error}
        </div>
    );

    const showSuccess = success => (
        <div className="alert alert-info" style={{ display: success ? '' : 'none' }}>
            Thanks! Your payment was successful!
        </div>
    );

    const showLoading = loading => loading && <h2 className="text-danger">Loading...</h2>;

    const buttonHandler = (b) => {
        console.log(button.receiver);
        
        return ( button.receiver && button.address1 && button.city && button.poscode ?  
            <button onClick={b} className="btn btn-success btn-block btn-afterblur">
                Pay
            </button> : 
            <button disabled onClick={b} className="btn btn-success btn-block btn-afterblur">
                Pay
            </button>
    
            
       )

    }


    return (
        <div>
            <h2>Total: RM {(Math.round((getTotal() + getShipping(data.state))*100)/100)}</h2>
            {showLoading(data.loading)}
            {showSuccess(data.success)}
            {showError(data.error)}
            
            
            {showCheckout()}
  
        </div>
    );
};

export default Checkout;
