import React from 'react';
import * as LucideIcons from 'lucide-react';

const DynamicIcon = ({ name, size = 20, color = 'currentColor', className = '' }) => {
    if (!name) return <LucideIcons.Circle size={size} color={color} className={className} />;

    try {
        // Convert kebab-case to PascalCase (e.g., help-circle -> HelpCircle)
        const PascalCaseName = name
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join('');

        const IconComponent = LucideIcons[PascalCaseName];

        if (!IconComponent) {
            return <LucideIcons.Circle size={size} color={color} className={className} />;
        }

        return <IconComponent size={size} color={color} className={className} />;
    } catch (error) {
        console.error('DynamicIcon render error:', error);
        return <LucideIcons.Circle size={size} color={color} className={className} />;
    }
};

export default DynamicIcon;
