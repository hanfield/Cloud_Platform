import React from 'react';
import OrderManagement from './OrderManagement';

const TenantOrders = () => {
    // Similar to TenantBilling, we reuse the OrderManagement component.
    // The backend will handle filtering based on the logged-in user.
    return <OrderManagement />;
};

export default TenantOrders;
