classdef STRRelease
     properties (Constant)
        KURigid = 1e15;
        KUFree = 1e-4;
        KRRigid = 1e15;
        KRFree  = 1e-4;
     end
     properties
        Id;
        Name;
        KuxStart;
        KuyStart;
        KuzStart;
        KrxStart;
        KryStart;
        KrzStart;
        
        KuxEnd;
        KuyEnd;
        KuzEnd;
        KrxEnd;
        KryEnd;
        KrzEnd;
     end

    methods
        function obj = STRRelease(id,name,kux1,kuy1,kuz1,krx1,kry1,krz1,kux2,kuy2,kuz2,krx2,kry2,krz2)
                    obj.Name = name;
                    obj.Id = id;
                    obj.KuxStart = kux1;
                    obj.KuyStart = kuy1;
                    obj.KuzStart = kuz1;
                    obj.KrxStart = krx1;
                    obj.KryStart = kry1;
                    obj.KrzStart = krz1;
                    
                    obj.KuxEnd = kux2;
                    obj.KuyEnd = kuy2;
                    obj.KuzEnd = kuz2;
                    obj.KrxEnd = krx2;
                    obj.KryEnd = kry2;
                    obj.KrzEnd = krz2;
        end

        function ToString(obj)
                fprintf(['Release (', obj.Name, ')']);
                fprintf(" #%i S[",obj.Id);
                if obj.KuxStart == obj.KUFree
                    fprintf('f');
                else
                    fprintf('x');
                end
        
                if obj.KuyStart == obj.KUFree
                    fprintf('f');
                else
                    fprintf('x');
                end
                
                if obj.KuzStart == obj.KUFree
                    fprintf('f');
                else
                    fprintf('x');
                end
        
                if obj.KrxStart == obj.KRFree
                    fprintf('f');
                else
                    fprintf('x');
                
                end
        
                if obj.KryStart == obj.KRFree
                    fprintf('f');
                else
                    fprintf('x');
                
                end
        
                if obj.KrzStart == obj.KRFree
                    fprintf('f');
                else
                    fprintf('x');
                
                end
                fprintf('] ---> ');

                fprintf("E[");
                if obj.KuxEnd == obj.KUFree
                    fprintf('f');
                else
                    fprintf('x');
                end
        
                if obj.KuyEnd == obj.KUFree
                    fprintf('f');
                else
                    fprintf('x');
                end
                
                if obj.KuzEnd == obj.KUFree
                    fprintf('f');
                else
                    fprintf('x');
                end
        
                if obj.KrxEnd == obj.KRFree
                    fprintf('f');
                else
                    fprintf('x');
                
                end
        
                if obj.KryEnd == obj.KRFree
                    fprintf('f');
                else
                    fprintf('x');
                
                end
        
                if obj.KrzEnd == obj.KRFree
                    fprintf('f');
                else
                    fprintf('x');
                
                end
                fprintf(']\n');
        end
    end
end