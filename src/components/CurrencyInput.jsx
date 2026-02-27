import React from 'react';

const CurrencyInput = ({ value, onChange, placeholder = '0', className = 'input-field', required = false, autoFocus = false }) => {
    const formatNumber = (num) => {
        if (num === '' || num === null || num === undefined) return '';
        const numStr = num.toString().replace(/\D/g, '');
        if (!numStr) return '';
        return new Intl.NumberFormat('en-US').format(parseInt(numStr, 10));
    };

    const handleChange = (e) => {
        const rawValue = e.target.value;
        const numericValue = rawValue.replace(/\D/g, '');
        onChange(numericValue);
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            className={className}
            placeholder={placeholder}
            value={formatNumber(value)}
            onChange={handleChange}
            required={required}
            autoFocus={autoFocus}
        />
    );
};

export default CurrencyInput;
