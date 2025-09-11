classdef STRSupport
     properties (Constant)
        KURigid = 1e15;
        KUFree = 1e-4;
        KRRigid = 1e15;
        KRFree  = 1e-4;
     end
    properties
        Id;
        Name;
        Kux;
        Kuy;
        Kuz;
        Krx;
        Kry;
        Krz;
    end
    methods

        function obj = STRSupport(id, name,kux, kuy, kuz, krx,kry,krz)
        obj.Id = id;
        obj.Name = name;
        obj.Kux = kux;
        obj.Kuy = kuy;
        obj.Kuz = kuz;
        obj.Krx = krx;
        obj.Kry = kry;
        obj.Krz = krz;
    end

    function ToString(obj)
        fprintf(['Support (', obj.Name, ')']);
        fprintf(" #%i [",obj.Id);
        if obj.Kux == obj.KUFree
            fprintf('f');
        else
            fprintf('x');
        end

        if obj.Kuy == obj.KUFree
            fprintf('f');
        else
            fprintf('x');
        end
        
        if obj.Kuz == obj.KUFree
            fprintf('f');
        else
            fprintf('x');
        end

        if obj.Krx == obj.KRFree
            fprintf('f');
        else
            fprintf('x');
        
        end

        if obj.Kry == obj.KRFree
            fprintf('f');
        else
            fprintf('x');
        
        end

        if obj.Krz == obj.KRFree
            fprintf('f');
        else
            fprintf('x');
        
        end
        fprintf(']\n');

    end
    end
    
end