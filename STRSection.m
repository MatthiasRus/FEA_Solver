classdef STRSection
    properties
        Id;
        Name;
        Ax;
        Ix;  %polar MI (torsion)
        Iy;  %second MI
        Iz;  %MI around vertical axis

    end

    methods
        function obj = STRSection(id,name,ax,ix,iy,iz)
            obj.Id = id;
            obj.Name = name;
            obj.Ax = ax;
            obj.Ix = ix;
            obj.Iy = iy;
            obj.Iz = iz;
        end

        function ToString(obj)
            fprintf('Section (%s) %i\n',obj.Name, obj.Id);
        end
    end
end
