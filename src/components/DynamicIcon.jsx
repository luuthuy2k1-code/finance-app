import React from 'react';
import * as LucideIcons from 'lucide-react';

const DynamicIcon = ({ name, size = 20, color = 'currentColor', className = '' }) => {
    if (!name) return <LucideIcons.Circle size={size} color={color} className={className} />;

    // Convert kebab-case to PascalCase (e.g., help-circle -> HelpCircle)
    const PascalCaseName = name
        .replace(/(^\w|-\w)/g, (clearAndUpper) => clearAndUpper.replace(/-/, '').toUpperCase());

    const IconComponent = LucideIcons[PascalCaseName];

    if (!IconComponent) return <LucideIcons.Circle size={size} color={color} className={className} />;

    return <IconComponent size={size} color={color} className={className} />;
};

export default DynamicIcon;
